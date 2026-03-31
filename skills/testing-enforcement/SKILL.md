---
name: testing-enforcement
description: Use this when a task changes behavior and needs disciplined test coverage.
---

# Testing Enforcement Skill

For any non-trivial change:

## Required

- test the changed behavior directly
- test at the correct layer
- include at least one edge/failure case
- avoid overly mocking core behavior when integration coverage is practical

## Coverage expectation

Aim for >= 80% coverage of the changed surface area.

## Test selection

- pure logic -> unit tests
- API + DB + service interactions -> integration tests
- critical user journeys -> e2e tests

## Completion rule

Do not claim completion if:

- code changed but tests did not
- test coverage misses the main user-visible behavior
- validation commands were not run
