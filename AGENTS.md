# Collaboration rules

## Communication

- Speak Russian with the user in chat. The user writes some JavaScript but primarily describes ideas in words; the agent handles implementation and testing.
- Explain decisions briefly and clearly. Add technical details when they help the user make a decision.
- These rules apply to this project.
- Use English throughout GitHub: branch names, commit messages, pull request and issue titles/descriptions, comments, and check results. Repository content must also be in English, including documentation, code comments, and interface text. Chat with the user remains in Russian.

## Discussion and iterations

- Start with brainstorming: clarify expected behavior, alternatives, and tradeoffs. Do not change code during the discussion stage.
- Before implementation, agree on a short plan divided into small iterations. Record the outcome and verifiable acceptance criteria for each iteration.
- Once the user asks to implement an iteration, carry out the agreed work independently, write and run tests, and fix issues found.
- Do not request confirmation for every technical step within the agreed task.
- Discuss new dependencies, significant architectural changes, and scope expansion before implementation.
- Avoid unrelated refactoring. Save new ideas in the backlog.
- Keep plans, decisions, and progress in repository documentation; update existing documents before creating duplicates.

## Branches and commits

- Develop on separate branches: one independent task per branch. Names must describe the feature or task, such as `feature/conditional-genes`, `fix/seed-crossover`, or `refactor/simulation-modules`. Do not use the `codex/` prefix or agent names.
- Before changes, check the current branch and working tree. Preserve existing user changes and exclude unrelated changes from your commits.
- Make small, meaningful commits. Commit code changes together with their tests on the same branch.
- After completing an iteration, passing checks, and committing, independently push the working branch to `origin` at `https://github.com/OlegRskn/tree-life.git`. These pushes do not require repeated user confirmation. Push only agreed project changes; force pushes are not authorized.
- Merge into `main` only after successful checks and an explicit user instruction to merge. Push authorization is not merge authorization.

## Required testing

- Testing is mandatory for every development iteration. Run checks locally and through GitHub Actions on pushes and pull requests targeting main. Do not set up automatic deployment yet.
- Store automated tests and their run configuration in the repository. Temporary checks outside the repository do not replace these tests.
- Add or update appropriate automated tests for new or changed behavior. Cover the main scenario, errors, and important edge cases rather than reproducing the implementation.
- For bug fixes, add a regression test: verify that it reproduces the issue before the fix and passes afterward.
- Also verify interface changes in a browser.
- Provide a clear local test command and document it in the README. Choose specific tools after examining the project.
- If tests fail or could not run, the iteration is not ready to merge into `main`.
- Before merging, wait for successful CI on the current commit when the branch already has a workflow.
- For documentation-only changes, check content and formatting; do not invent code tests for them.

## Completing an iteration

- Report what changed, which checks ran and their results, what remains unverified, and any known issues.
- Ready means that the agreed criteria are met, checks pass, the main scenario works, and there are no known blocking issues.
- The user evaluates whether the result matches their intent before deciding to merge.
