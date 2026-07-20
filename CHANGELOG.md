# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Nothing yet.

---

## [0.1.0] - 2024-01-01

### Added
- Initial release.
- `build` command: analyze TypeScript/JavaScript source and generate context packs.
- `watch` command: watch for changes and queue them for explicit approval.
- `verify` command: fail-closed integrity check (TTL, schema, hash).
- `queue list/approve/reject/clear` subcommands.
- Agent adapters: `copilot`, `cursor`, `claude`, `codex`, `gemini`.
- Output artifacts: `manifest.json`, `definitions.jsonl`, `dependencies.jsonl`, `ast_chunks.jsonl`, `queue.json`, `audit.log.jsonl`.
- `--all` flag to enable all agents at once.
- `--dry-run`, `--changed-only`, `--no-interactive` flags.
- Deterministic, sorted output ordering.
- AJV schema validation for `manifest.json` and `queue.json`.
- SHA-256 hash integrity for all tracked files.
- Pino-based structured logging with pino-pretty for TTY.
- Vitest test suite with fixtures and snapshot coverage.

[Unreleased]: https://github.com/yourusername/ctxpacker-tool/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/ctxpacker-tool/releases/tag/v0.1.0
