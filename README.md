# ctxpacker-tool

> Generate deterministic, agent-targeted context packs from your codebase for AI coding assistants — with explicit approval gates.

[![npm version](https://img.shields.io/npm/v/ctxpacker-tool.svg)](https://www.npmjs.com/package/ctxpacker-tool)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [What is it?](#what-is-it)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Watch + Approval Workflow](#watch--approval-workflow)
- [Output Artifacts](#output-artifacts)
- [Configuration Options](#configuration-options)
- [Agent Adapters](#agent-adapters)
- [Governance Model](#governance-model)
- [npm Publishing Checklist](#npm-publishing-checklist)
- [Contributing](#contributing)

---

## What is it?

`ctxpacker-tool` scans your TypeScript/JavaScript project, extracts AST chunks, type definitions, and dependency graphs, and writes **deterministic context packs** in formats optimised for each AI coding assistant (GitHub Copilot, Cursor, Claude, OpenAI Codex, Google Gemini).

Key design principles:
- **Explicit approval gate** — watch mode never auto-applies changes. Every change is queued and requires `queue approve`.
- **Deterministic output** — given the same source, the same artifacts are produced every time.
- **Agent-targeted** — select only the adapters you need; unused agents are not generated.
- **Fail-closed verification** — `verify` rejects expired, hash-mismatched, or schema-invalid packs.

---

## Installation

### Global (recommended for one-off use)

```bash
npm i -g ctxpacker-tool
ctxpacker-tool build . --copilot
```

### Local (recommended for team use / CI)

```bash
npm i -D ctxpacker-tool
npx ctxpacker-tool build . --copilot --cursor
```

---

## Quick Start

```bash
# Analyze current directory for GitHub Copilot and Cursor
ctxpacker-tool build . --copilot --cursor

# All agents at once
ctxpacker-tool build ./src --all

# Custom output directory
ctxpacker-tool build . --copilot --out .my-pack

# Preview without writing (dry-run)
ctxpacker-tool build . --copilot --dry-run
```

---

## Commands

### `build [path]`

Analyze source files and generate the context pack.

```
ctxpacker-tool build [path] [options]

Arguments:
  path                    Source directory to analyze (default: ".")

Agent flags (at least one required):
  --copilot               Generate GitHub Copilot adapter
  --cursor                Generate Cursor adapter
  --claude                Generate Claude adapter
  --codex                 Generate OpenAI Codex adapter
  --gemini                Generate Google Gemini adapter
  --all                   Generate all agent adapters

Options:
  --out <dir>             Output directory (default: ".agent-cache/context-pack")
  --ttl-minutes <n>       Pack TTL in minutes (default: 120)
  --max-chunk-tokens <n>  Max tokens per chunk (default: 600)
  --changed-only          Only process files changed since last build
  --dry-run               Print what would be done without writing
  --no-interactive        Disable interactive prompts
```

### `watch [path]`

Watch for file changes and **queue** them for approval. Changes are never auto-applied.

```
ctxpacker-tool watch [path] [agent flags] [options]

Options (additional to build options):
  --debounce-ms <n>       Debounce delay in ms (default: 1000)
```

### `verify`

Verify a context pack for schema validity, TTL, and hash integrity.

```
ctxpacker-tool verify --pack <dir>
```

Exits with code `1` if the pack is invalid (expired, hash mismatch, schema error, missing files).

### `queue list`

Show all pending changes waiting for approval.

```
ctxpacker-tool queue list --pack <dir>
```

### `queue approve <id|all>`

Integrate approved changes into the pack artifacts.

```
ctxpacker-tool queue approve all --pack <dir>
ctxpacker-tool queue approve abc123def --pack <dir>
```

### `queue reject <id|all>`

Discard queued changes without applying them.

```
ctxpacker-tool queue reject all --pack <dir>
```

### `queue clear`

Remove all items from the queue (regardless of status).

```
ctxpacker-tool queue clear --pack <dir>
```

---

## Watch + Approval Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. Start watcher                                   │
│     $ ctxpacker-tool watch . --copilot         │
│                                                     │
│  2. Edit source files …                             │
│     → Changes are QUEUED, never auto-applied        │
│     → queue.json updated in the pack directory      │
│                                                     │
│  3. Review pending changes                          │
│     $ ctxpacker-tool queue list \              │
│         --pack .agent-cache/context-pack            │
│                                                     │
│  4. Approve (integrates into pack artifacts)        │
│     $ ctxpacker-tool queue approve all \       │
│         --pack .agent-cache/context-pack            │
│                                                     │
│     — OR —                                          │
│                                                     │
│     Reject (discard without applying)               │
│     $ ctxpacker-tool queue reject all \        │
│         --pack .agent-cache/context-pack            │
└─────────────────────────────────────────────────────┘
```

**Why explicit approval?** AI agents consuming context packs should operate on audited, stable snapshots — not mid-edit noise. The approval gate ensures the context pack always reflects a consciously reviewed state.

---

## Output Artifacts

```
.agent-cache/context-pack/
├── manifest.json          # Project metadata, file hashes, TTL
├── definitions.jsonl      # Exported types, classes, functions, enums (one JSON per line)
├── dependencies.jsonl     # Import graph (one JSON per line)
├── ast_chunks.jsonl       # Token-bounded code chunks (one JSON per line)
├── queue.json             # Pending / approved / rejected change items
├── audit.log.jsonl        # Append-only audit log
└── adapters/
    ├── copilot.json       # GitHub Copilot context pack
    ├── cursor.json        # Cursor context pack
    ├── claude.json        # Claude context pack
    ├── codex.json         # OpenAI Codex context pack
    └── gemini.json        # Google Gemini context pack
```

---

## Configuration Options

| Flag | Default | Description |
|---|---|---|
| `--out` | `.agent-cache/context-pack` | Output directory |
| `--ttl-minutes` | `120` | Minutes before pack expires |
| `--max-chunk-tokens` | `600` | Max tokens per AST chunk |
| `--changed-only` | `false` | Re-process only changed files |
| `--debounce-ms` | `1000` | Watch debounce delay |
| `--dry-run` | `false` | No-op; print actions only |
| `--no-interactive` | `false` | Suppress interactive prompts |

---

## Agent Adapters

Each adapter JSON contains:

```json
{
  "agent": "copilot",
  "format": "github-copilot-context-v1",
  "version": "1",
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "sourceRoot": "/absolute/path/to/project",
  "chunks": [ /* AstChunk[] */ ],
  "definitions": [ /* DefinitionEntry[] */ ],
  "instructions": "Feed chunks to the AI as grounding context…"
}
```

---

## Governance Model

`ctxpacker-tool` enforces a **mandatory human approval gate**:

1. `watch` detects changes → writes to `queue.json` → stops.
2. No pack artifact is ever modified by the watcher alone.
3. `queue approve` is the only path to integrating changes.
4. `queue reject` discards changes without touching the pack.
5. `verify` fails closed on any integrity violation (expired, hash mismatch, schema error).

This means AI tools consuming the pack always see a human-reviewed snapshot.

---

## npm Publishing Checklist

Before your first release:

- [ ] Update `name` in `package.json` to a unique npm-available name
- [ ] Set `repository`, `homepage`, `bugs` URLs to your actual repo
- [ ] Set `author` to your name / org
- [ ] Update `CHANGELOG.md` with version `0.1.0` entry
- [ ] Run `npm run pack:check` — verify tarball contents
- [ ] Run `npm run release:dry` — dry-run publish to inspect
- [ ] Create an npm account at https://www.npmjs.com if needed
- [ ] Enable npm provenance (GitHub Actions + `--provenance` flag)
- [ ] Tag the release: `git tag v0.1.0 && git push --tags`
- [ ] Publish: `npm run release`

### Provenance (supply-chain security)

Add to your GitHub Actions workflow:

```yaml
- name: Publish
  run: npm publish --access public --provenance
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Requires `permissions: id-token: write` in the job.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure policy.
