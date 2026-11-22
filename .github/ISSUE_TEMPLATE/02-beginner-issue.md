---
name: Beginner Issue
about: A well-scoped task for contributors ready to research the codebase (~8 hours)
labels: ["skill: beginner"]
---

<!-- Everything outside "The task" is boilerplate: leave it, or trim what doesn't apply. Title: a plain sentence, no "feat:"/"fix:" prefix. -->

> **Beginner Issue**: a well-scoped task for contributors ready to learn this codebase and own a small implementation.
> **Time:** ~8 hours · **Prerequisites:** about one completed [Good First Issue](https://github.com/hiero-hackers/hiero-enterprise-js/issues?q=is%3Aissue%20label%3A%22good%20first%20issue%22) recommended; comfortable forking, branching and opening a PR without a tutorial.
> If that feels unfamiliar, a Good First Issue is the better start; you can always come back.

## The task

<!-- Author: this is the only section you write. Give the shape of the work, not the steps: the contributor researches and designs the approach. -->

### Problem

<!-- Author: 1-2 sentences: the problem, its impact, and the package (core or mirror) and area it is in. -->

### Solution

<!-- Author: 1 sentence on what is needed, then about 3 high-level steps. No file-by-file walkthrough. Say which tests are expected. -->

### Where to look first

<!-- Author: 2-3 files, and one existing pattern in the codebase worth studying before coding. -->

## How to work on this

1. **Claim it:** comment that you'd like to work on it and wait for a maintainer to assign you before opening a PR.
2. **Get oriented:** read the [coding standards](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#coding-standards), the [naming and structure conventions](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#naming--structure-conventions) and the [DCO](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#dco-sign-off) and [GPG](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#gpg-signed-commits) requirements.
3. **Research, design, then solve it:** read the files above and their tests, work out the approach yourself, then implement it.

**Before opening your PR:**

- [ ] I read the relevant code and its tests before writing any
- [ ] I worked out the approach myself and can explain it
- [ ] The implementation follows the surrounding patterns
- [ ] I added tests for what I changed, following the package's existing test layout
- [ ] My changes stay within the scope of this issue
- [ ] `pnpm build`, `pnpm lint`, `pnpm format:check` and `pnpm test:unit` pass
- [ ] I added a [`CHANGELOG.md` entry](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#changelog) if users of the packages would notice the change
- [ ] The PR description links this issue with `Closes #<number>`, and the PR has an assignee
- [ ] My commits are signed off and GPG-signed: `git commit -S -s -m "fix: description"`

**Stuck?** Comment here with what you have tried. A maintainer will respond.
