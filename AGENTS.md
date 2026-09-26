# OwlHacks2026 Development Guidelines

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
