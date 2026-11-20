---
name: create-issue
description: Author a GitHub issue for hiero-enterprise-js that fits the difficulty ladder, label rules and house style. Use when asked to create, draft, or seed issues.
---

# Creating issues for hiero-enterprise-js

Target repo: `hiero-hackers/hiero-enterprise-js`. Create with `gh issue create -R hiero-hackers/hiero-enterprise-js`.

## Title

A plain sentence that says what is wrong or what to do, no conventional-commit prefix: "The mirror client retries 501 Not Implemented responses", "Remove Node-only Buffer and process usage from core and mirror". Classification goes in labels, not the title.

## Labels

- **Type**, one: `bug`, `enhancement`, `documentation` or `test`.
- **Package**, one or both: `core` (`@hiero-hackers/enterprise-core`), `mirror` (`@hiero-hackers/enterprise-mirror`). Omit for repo-wide work (CI, docs).
- **Level**, exactly one, from the ladder below.
- Don't add `pending-review` or `approved`: the `moderate-new-issues` workflow adds `pending-review` (and locks the issue) on open, and a maintainer adds `approved`, which unlocks it. Other status labels (`status: needs discussion`, `blocked`) only when they apply.

## The difficulty ladder

| Level                 | Template                   | Time  | Prerequisites                                  | Body style                                                                                                                              |
| --------------------- | -------------------------- | ----- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `good first issue`    | `01-good-first-issue.md`   | ~4h   | none, no repo or Hiero context                 | **Guided walkthrough**: numbered steps, exact files, the test to add, how to verify. Write for someone who has never seen the codebase. |
| `skill: beginner`     | `02-beginner-issue.md`     | ~8h   | can fork, branch and open a PR unaided         | **Shape of the work**: problem, ~3 high-level steps, files and a pattern to study. Design calls left to the contributor.                |
| `skill: intermediate` | `03-intermediate-issue.md` | ~25h  | navigates both packages and their conventions  | **Goals and constraints**: problem, what done looks like, modules involved, what must not break. Don't prescribe the approach.          |
| `skill: advanced`     | `04-advanced-issue.md`     | ~30h+ | deep context on core, mirror and the Hiero SDK | **Problem space**: the end state as far as known, known unknowns and risks. Name what is decided vs open.                               |

Pick the level from what the work demands, not from how much you write, then write the amount that level calls for.

## Use the templates

The templates in `.github/ISSUE_TEMPLATE/` carry the level banner, setup links and PR checklist, and set the level label. Read the template for the chosen level, fill only its "The task" section (`### Problem`, then the level's other headings), keep the rest verbatim, and pass it with `--body-file`. Add the type and package labels with `--label`.

`bug.yml` and `feature.yml` stay for reports from users; an issue a maintainer writes for a contributor to pick up uses a level template.

## Body conventions

- Open with the **Problem**: what is wrong or missing, with a concrete case (the call, the input, what happens now). Cite file and line, e.g. `HieroContext.ts:69`.
- **Pointers, not prose dumps**: name 1-3 files or an existing method to copy the pattern from.
- Link to where a rule lives (a `CONTRIBUTING.md` section, a workflow) rather than restating it.
- Name what is **out of scope** when a helpful contributor would plausibly overreach.
- Say which tests are expected: unit tests always; integration tests against Solo when the change touches the network.
- Never claim the code does something without checking: read the file first, and reproduce a bug on `main`.

## Blocked work

Use GitHub's native dependency as well as a line at the top of the body:

```bash
gh api -X POST repos/hiero-hackers/hiero-enterprise-js/issues/<N>/dependencies/blocked_by \
  -F issue_id="$(gh api repos/hiero-hackers/hiero-enterprise-js/issues/<BLOCKER> -q .id)"
```
