#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_CSV_PATH = "docs/LINEAR_BACKLOG_IMPORT.csv";

function printUsage() {
  console.log(`Usage: node scripts/import-github-issues.mjs [options]

Options:
  --csv <path>           CSV file to import (default: ${DEFAULT_CSV_PATH})
  --repo <owner/name>    GitHub repository (default: current gh repo)
  --dry-run              Preview actions without creating labels or issues
  --create-labels        Create missing GitHub labels before issue creation
  --limit <number>       Import only the first N records
  --help                 Show this help message
`);
}

function parseArgs(argv) {
  const options = {
    csv: DEFAULT_CSV_PATH,
    repo: "",
    dryRun: false,
    createLabels: false,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--csv") {
      options.csv = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--repo") {
      options.repo = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const rawValue = argv[index + 1] ?? "";
      const limit = Number(rawValue);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Invalid --limit value: ${rawValue}`);
      }
      options.limit = limit;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--create-labels") {
      options.createLabels = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value.length > 0));
}

function parseCsvRecords(content) {
  const rows = parseCsv(content);
  if (rows.length < 2) {
    throw new Error("CSV must contain a header row and at least one record");
  }

  const [header, ...records] = rows;
  return records.map((record, rowIndex) => {
    const current = Object.fromEntries(
      header.map((column, columnIndex) => [column, record[columnIndex] ?? ""]),
    );

    if (!current.Title?.trim()) {
      throw new Error(`CSV row ${rowIndex + 2} is missing Title`);
    }

    if (!current.Description?.trim()) {
      throw new Error(`CSV row ${rowIndex + 2} is missing Description`);
    }

    return current;
  });
}

export function splitLabels(rawValue) {
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function inferLabelConfig(label) {
  if (label.startsWith("area:")) {
    return {
      color: "0e8a16",
      description: "Backlog area label imported from planning docs",
    };
  }

  if (label.startsWith("type:")) {
    return {
      color: "5319e7",
      description: "Backlog work type imported from planning docs",
    };
  }

  if (label === "priority:p0") {
    return {
      color: "b60205",
      description: "Highest-priority backlog item",
    };
  }

  if (label === "priority:p1") {
    return {
      color: "d93f0b",
      description: "Important backlog item",
    };
  }

  if (label === "priority:p2") {
    return {
      color: "fbca04",
      description: "Lower-priority backlog item",
    };
  }

  return {
    color: "0366d6",
    description: "Imported backlog label",
  };
}

export function buildIssueBody(record, sourcePath) {
  const description = record.Description.trim();
  const metadata = [
    `Imported from \`${sourcePath}\`.`,
    record.Priority?.trim() ? `- Priority: ${record.Priority.trim()}` : null,
    record.Status?.trim() ? `- Status: ${record.Status.trim()}` : null,
    record.Estimate?.trim() ? `- Estimate: ${record.Estimate.trim()}` : null,
  ].filter(Boolean);

  return `${description}\n\n---\n${metadata.join("\n")}\n`;
}

function runGh(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function resolveRepo(explicitRepo) {
  if (explicitRepo) return explicitRepo;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return runGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
}

function getExistingIssueTitles(repo) {
  const output = runGh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "1000",
    "--json",
    "title",
  ]);
  const issues = JSON.parse(output);
  return new Set(
    issues
      .map((issue) => (typeof issue.title === "string" ? issue.title.trim() : ""))
      .filter(Boolean),
  );
}

function getExistingLabels(repo) {
  const output = runGh([
    "label",
    "list",
    "--repo",
    repo,
    "--limit",
    "1000",
    "--json",
    "name",
  ]);
  const labels = JSON.parse(output);
  return new Set(
    labels
      .map((label) => (typeof label.name === "string" ? label.name.trim() : ""))
      .filter(Boolean),
  );
}

function ensureLabels(repo, labels, existingLabels, dryRun) {
  const missingLabels = labels.filter((label) => !existingLabels.has(label));
  if (missingLabels.length === 0) return [];

  if (dryRun) {
    return missingLabels;
  }

  for (const label of missingLabels) {
    const config = inferLabelConfig(label);
    runGh([
      "label",
      "create",
      label,
      "--repo",
      repo,
      "--color",
      config.color,
      "--description",
      config.description,
    ]);
    existingLabels.add(label);
  }

  return missingLabels;
}

function createIssue(repo, title, body, labels) {
  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    title,
    "--body",
    body,
  ];

  for (const label of labels) {
    args.push("--label", label);
  }

  return runGh(args);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(process.cwd(), options.csv);

  if (!existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const repo = resolveRepo(options.repo);
  const records = parseCsvRecords(readFileSync(csvPath, "utf8"));
  const limitedRecords =
    options.limit == null ? records : records.slice(0, options.limit);
  const existingIssueTitles = getExistingIssueTitles(repo);
  const existingLabels = getExistingLabels(repo);
  const sourcePath = path.relative(process.cwd(), csvPath);

  const allLabels = [
    ...new Set(limitedRecords.flatMap((record) => splitLabels(record.Labels ?? ""))),
  ];
  const missingLabels = allLabels.filter((label) => !existingLabels.has(label));

  console.log(
    `Preparing ${limitedRecords.length} backlog record(s) for ${repo} from ${sourcePath}.`,
  );

  if (missingLabels.length > 0) {
    if (options.createLabels) {
      const handledLabels = ensureLabels(
        repo,
        missingLabels,
        existingLabels,
        options.dryRun,
      );
      const labelVerb = options.dryRun ? "Would create" : "Created";
      for (const label of handledLabels) {
        console.log(`${labelVerb} label: ${label}`);
      }
    } else {
      throw new Error(
        `Missing GitHub labels: ${missingLabels.join(", ")}. Re-run with --create-labels.`,
      );
    }
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const record of limitedRecords) {
    const title = record.Title.trim();
    const labels = splitLabels(record.Labels ?? "");

    if (existingIssueTitles.has(title)) {
      skippedCount += 1;
      console.log(`Skip existing issue: ${title}`);
      continue;
    }

    const body = buildIssueBody(record, sourcePath);

    if (options.dryRun) {
      createdCount += 1;
      console.log(
        `Dry run: would create issue "${title}"${labels.length > 0 ? ` with labels [${labels.join(", ")}]` : ""}.`,
      );
      continue;
    }

    const issueUrl = createIssue(repo, title, body, labels);
    existingIssueTitles.add(title);
    createdCount += 1;
    console.log(`Created issue: ${issueUrl}`);
  }

  console.log(
    `${options.dryRun ? "Dry run complete" : "Import complete"}: ${createdCount} to create, ${skippedCount} skipped.`,
  );
}

const isDirectRun =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
