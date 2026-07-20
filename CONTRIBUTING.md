# Contributing to ctxpacker-tool

Thank you for your interest in contributing! 🎉

## Development Setup

```bash
git clone https://github.com/yourusername/ctxpacker-tool.git
cd ctxpacker-tool
npm install
npm run build
npm test
```

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add gemini adapter
fix: correct hash comparison in verify command
docs: update watch workflow section in README
chore: bump ts-morph to 23
test: add queue deduplication test
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`.

Breaking changes: append `!` or add `BREAKING CHANGE:` footer.

## Pull Request Checklist

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run lint` passes with no warnings
- [ ] `npm test` passes
- [ ] New features include tests
- [ ] CHANGELOG.md updated under `[Unreleased]`

## Project Structure

```
src/
  cli.ts            CLI entry point (commander program)
  commands/         Command implementations
  core/             Analyzer, chunker, writer, adapters
  queue/            Queue CRUD operations
  schema/           AJV validators
  utils/            Logger, hash, token, format helpers
tests/
  fixtures/         Sample TypeScript project for integration tests
  commands/         Command-level tests
  core/             Unit tests for core modules
scripts/
  check-pack.js     Validates npm tarball contents
```

## Running a Single Test File

```bash
npx vitest run tests/core/analyzer.test.ts
```

## Release Process

Releases are handled by maintainers via `npm run release` after passing all checks in `prepublishOnly`.

## Code of Conduct

Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
