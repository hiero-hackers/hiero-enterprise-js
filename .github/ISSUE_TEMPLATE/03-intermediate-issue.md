---
name: Intermediate Issue
about: A task across several modules that needs independent research and thorough testing (~25 hours)
labels: ["skill: intermediate"]
---

<!-- Everything outside "The task" is boilerplate: leave it, or trim what doesn't apply. Title: a plain sentence, no "feat:"/"fix:" prefix. -->

> **Intermediate Issue**: a task spanning several modules or both packages, with real design decisions to own.
> **Time:** ~25 hours · **Prerequisites:** comfortable navigating this repo and its conventions (a few completed [beginner issues](https://github.com/hiero-hackers/hiero-enterprise-js/issues?q=is%3Aissue%20label%3A%22skill%3A%20beginner%22) is the usual route).
> We expect more than "it works": maintainable code that fits the existing architecture.

## The task

<!-- Author: this is the only section you write, for someone who already knows the packages and their tests. Name the modules and constraints; the contributor owns the design. -->

### Problem

<!-- Author: one line each: what breaks or is missing; which modules carry it and who feels it; what puts this above beginner. -->

### What done looks like

<!-- Author: the end state a reviewer can check, not the method. Include the testing expectations (unit, and integration against Solo if it touches the network). -->

### Modules involved

<!-- Author: the packages and directories this reaches (e.g. packages/core/src/services/, packages/mirror/src/client/), and what each contributes. -->

### Constraints

<!-- Author: what the solution must not break: public API compatibility, error codes, the mirror spec-coverage check, coverage thresholds. Leave the approach open. -->

## How to work on this

1. **Claim it:** comment that you'd like to work on it and wait for a maintainer to assign you before opening a PR.
2. **Propose your approach as a comment before coding.** A paragraph is enough; early feedback saves rework.
3. **Read before you decide:** the README of every package you plan to touch ([core](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/packages/core/README.md), [mirror](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/packages/mirror/README.md)), the [naming and structure conventions](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#naming--structure-conventions), and for mirror work [Adding a mirror endpoint](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#adding-a-mirror-endpoint). Integration tests run against a local Solo network: see [Running Integration Tests](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#running-integration-tests).

**Before opening your PR:**

- [ ] I proposed my approach on this issue and incorporated any feedback
- [ ] The solution fits the existing architecture and is clear enough for others to maintain
- [ ] Tests cover the happy path, edge cases and error handling; integration tests where the network is involved
- [ ] I reviewed my own diff line by line; scope is limited to this issue
- [ ] `pnpm build`, `pnpm lint`, `pnpm format:check` and `pnpm test:unit` pass
- [ ] I added a [`CHANGELOG.md` entry](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#changelog) if users of the packages would notice the change
- [ ] The PR description links this issue with `Closes #<number>`, and the PR has an assignee
- [ ] My commits are signed off and GPG-signed: `git commit -S -s -m "feat: description"`

**Stuck?** Comment here with what you have tried. A maintainer will respond.
