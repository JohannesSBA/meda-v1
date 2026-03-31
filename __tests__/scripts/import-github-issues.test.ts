import { describe, expect, it } from "vitest";

import {
  buildIssueBody,
  inferLabelConfig,
  parseCsv,
  splitLabels,
} from "../../scripts/import-github-issues.mjs";

describe("import-github-issues helpers", () => {
  it("parses multiline quoted csv fields", () => {
    const rows = parseCsv(`Title,Description,Labels
"Issue one","## Problem

Line two","area:auth, type:bug"
"Issue two","Single line","priority:p1"
`);

    expect(rows).toEqual([
      ["Title", "Description", "Labels"],
      ["Issue one", "## Problem\n\nLine two", "area:auth, type:bug"],
      ["Issue two", "Single line", "priority:p1"],
    ]);
  });

  it("splits csv label fields safely", () => {
    expect(splitLabels("area:auth, type:tech-debt, priority:p0")).toEqual([
      "area:auth",
      "type:tech-debt",
      "priority:p0",
    ]);
    expect(splitLabels("")).toEqual([]);
  });

  it("builds markdown issue bodies with metadata", () => {
    const body = buildIssueBody(
      {
        Description: "## Problem\n\nSomething broke.",
        Priority: "High",
        Status: "Backlog",
        Estimate: "",
      },
      "docs/LINEAR_BACKLOG_IMPORT.csv",
    );

    expect(body).toContain("## Problem");
    expect(body).toContain("Imported from `docs/LINEAR_BACKLOG_IMPORT.csv`.");
    expect(body).toContain("- Priority: High");
    expect(body).toContain("- Status: Backlog");
    expect(body).not.toContain("- Estimate:");
  });

  it("assigns stable label metadata by prefix", () => {
    expect(inferLabelConfig("area:payments")).toMatchObject({
      color: "0e8a16",
    });
    expect(inferLabelConfig("type:testing")).toMatchObject({
      color: "5319e7",
    });
    expect(inferLabelConfig("priority:p0")).toMatchObject({
      color: "b60205",
    });
  });
});
