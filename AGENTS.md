# OwlHacks2026 Development Guidelines

## Collaboration and Scope

- Treat the user's requested task as the boundary of the change.
- Edit only files clearly required by that task.
- Do not reformat, refactor, rename, or reorganize unrelated website files.
- Do not run repository-wide formatters unless formatting the entire repository is explicitly requested.
- Inspect the current worktree and existing changes before editing.
- Preserve changes made by the user or other collaborators.
- Never revert unrelated work.
- Keep diffs minimal and focused.
- Ask before expanding the scope or changing the architecture.
- Before substantial edits, state which files will change and why.
- Do not edit files outside this repository unless explicitly authorized.
- Do not commit, amend, or push unless explicitly requested.

Agents may inspect the full repository, but implementation changes should remain
limited to the files required by the current task.

## Formatting

- Use Prettier for JavaScript, TypeScript, CSS, JSON, Markdown, YAML, and workflow files.
- Use four spaces for indentation. Use spaces, not tab characters.
- Use single quotes in JavaScript and TypeScript.
- Use semicolons.
- Use a 120-character print width.
- Use trailing commas wherever Prettier supports them.
- Always parenthesize arrow-function parameters.
- `package-lock.json` is generated and is intentionally excluded from Prettier.

## Quality Checks

Run these commands before completing changes:

```bash
npm run format:check
npm run lint
npm test -- --watchAll=false
npm run build
```

Formatting and linting are required in CI. Keep all application changes and
tooling changes within this repository.
