---
name: feature-delivery
description: Use this when designing or implementing a new feature from concept to production.
---

# Feature Delivery Skill

Use this workflow for all feature work.

## Step 1: Understand

Read the relevant code paths and identify:

- domain boundaries
- data ownership
- current user flow
- existing patterns that should be reused

## Step 2: Design

Before coding, produce:

- problem statement
- user story
- constraints
- impacted layers
- proposed implementation
- risks
- test plan
- rollout notes

## Step 3: Implement

Implement in this order unless the repo suggests otherwise:

1. schema / domain model
2. backend contracts
3. service logic
4. UI wiring
5. telemetry / analytics
6. tests
7. docs / release notes if needed

## Step 4: Validate

Run the strongest validations available:

- unit
- integration
- e2e
- lint
- typecheck
- build

## Step 5: Final Review

Check:

- architecture alignment
- naming consistency
- unnecessary complexity
- edge cases
- security / auth
- rollback and migration concerns

## Output format

Return:

1. brief plan
2. implemented changes
3. tests added
4. commands run
5. risks / follow-ups
