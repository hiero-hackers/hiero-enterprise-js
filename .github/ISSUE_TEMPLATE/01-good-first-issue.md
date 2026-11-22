---
name: Good First Issue
about: A small, guided change for first-time contributors (~4 hours)
labels: ["good first issue"]
---

<!-- Everything outside "The task" is boilerplate: leave it, or trim what doesn't apply. Title: a plain sentence, no "feat:"/"fix:" prefix. -->

> **Good First Issue**: a small, well-contained change for first-time contributors.
> **Time:** ~4 hours including setup · **Prerequisites:** none, no repo or Hiero knowledge needed.
> Setup takes minutes: install the [requirements](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#requirements) and follow [Building the Library](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#building-the-library). No network or Solo is needed.

## The task

<!-- Author: this is the only section you write. Write for someone who has never seen this codebase. -->

### Problem

<!-- Author: 1-2 sentences: what is wrong or missing, why it matters, and which package (core or mirror) it is in. -->

### Solution

<!-- Author: 1 sentence: what the change is. Be clear and direct. -->

### Steps

<!-- Author: about 5 numbered steps: the exact files to change, the test file to add a case to, and how to check the result (e.g. `pnpm --filter @hiero-hackers/enterprise-core test:unit`). -->

## How to work on this

1. **Claim it:** comment that you'd like to work on it and wait for a maintainer to assign you before opening a PR.
2. **Get oriented:** read the [coding standards](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#coding-standards) and the [DCO sign-off](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#dco-sign-off) and [GPG signing](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#gpg-signed-commits) requirements.
3. **Solve it:** make the change, add a unit test for it, and run the checks below.

**Before opening your PR:**

- [ ] I ran the change locally and checked it does what the issue asks
- [ ] I added or updated a unit test for the change
- [ ] My changes stay within the scope of this issue
- [ ] `pnpm build`, `pnpm lint`, `pnpm format:check` and `pnpm test:unit` pass
- [ ] I added a [`CHANGELOG.md` entry](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#changelog) if users of the packages would notice the change
- [ ] The PR description links this issue with `Closes #<number>`, and the PR has an assignee
- [ ] My commits are signed off and GPG-signed: `git commit -S -s -m "fix: description"`

**Stuck?** Comment here with what you have tried. A maintainer will respond.
