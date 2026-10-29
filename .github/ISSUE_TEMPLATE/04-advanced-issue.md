---
name: Advanced Issue
about: Architectural or cross-package work for proven contributors (~30+ hours)
labels: ["skill: advanced"]
---

<!-- Everything outside "The task" is boilerplate: leave it, or trim what doesn't apply. Title: a plain sentence, no "feat:"/"fix:" prefix. -->

> **Advanced Issue**: the most complex work in this project: architectural, cross-package or public-API changes where the solution itself may need discovering.
> **Time:** ~30+ hours · **Prerequisites:** a track record here and deep context on core, mirror and the Hiero SDK they build on (several completed [intermediate issues](https://github.com/hiero-hackers/hiero-enterprise-js/issues?q=is%3Aissue%20label%3A%22skill%3A%20intermediate%22) is the usual route).
> The bar is production-ready: safe, maintainable, architecturally sound.

## The task

<!-- Author: this is the only section you write. Where the solution is uncertain, say what is unknown: mapping that uncertainty is part of the task. -->

### Problem

<!-- Author: 1-2 sentences: the problem and its impact across the packages. Link the HIP, SDK API, mirror node endpoint or earlier issue it touches. -->

### What done looks like

<!-- Author: the end state, as far as it is known. "Finding out what good looks like is the task" is a valid answer here; then say what would count as progress. -->

### Known unknowns and risks

<!-- Author: what is uncertain, what could break (public API, behaviour changes, published types), and what would have to be measured or proven. Don't guess the approach for the contributor. -->

## How to work on this

1. **Claim it:** comment that you'd like to work on it and wait for a maintainer to assign you before opening a PR.
2. **Propose your design as a comment before building.** Cover the approach, the alternatives you rejected and the impact on both packages. For large changes, say how you will split the work into reviewable PRs.
3. **Read before you lock a design:** the [core](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/packages/core/README.md) and [mirror](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/packages/mirror/README.md) READMEs, [Verifying the Published Type Surface](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#verifying-the-published-type-surface), the [test quick reference](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#test-quick-reference) and the [changelog rules](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#changelog) for behaviour changes.

**Before opening your PR:**

- [ ] The PR includes a short design note: approach, alternatives considered, affected packages, compatibility impact
- [ ] Correctness and safety are tested, not assumed: unit tests, and integration tests against Solo where the network is involved
- [ ] The published types still check out (`tsc --noEmit`, `attw --pack`)
- [ ] I reviewed my own diff as if it were someone else's
- [ ] `pnpm build`, `pnpm lint`, `pnpm format:check` and `pnpm test:unit` pass
- [ ] I added a [`CHANGELOG.md` entry](https://github.com/hiero-hackers/hiero-enterprise-js/blob/main/CONTRIBUTING.md#changelog), marking any **Behavior change:**
- [ ] The PR description links this issue with `Closes #<number>`, and the PR has an assignee
- [ ] My commits are signed off and GPG-signed: `git commit -S -s -m "feat: description"`

**Review expectations:** advanced PRs get probing questions and may take longer to review; that is intended. **Stuck or want a design sounding board?** Comment here with what you have tried.
