import path from 'path';
import type { BuildOptions, WatchOptions } from './types.js';

export const DEFAULT_OUT_DIR = path.join('.agent-cache', 'context-pack');
export const DEFAULT_TTL_MINUTES = 120;
export const DEFAULT_MAX_CHUNK_TOKENS = 600;
export const DEFAULT_DEBOUNCE_MS = 1000;

export const ARTIFACT_FILES = [
  'manifest.json',
  'definitions.jsonl',
  'dependencies.jsonl',
  'ast_chunks.jsonl',
  'queue.json',
  'audit.log.jsonl',
] as const;

export const SCHEMA_VERSION = '1';

export function defaultBuildOptions(overrides: Partial<BuildOptions> = {}): BuildOptions {
  return {
    out: DEFAULT_OUT_DIR,
    ttlMinutes: DEFAULT_TTL_MINUTES,
    maxChunkTokens: DEFAULT_MAX_CHUNK_TOKENS,
    changedOnly: false,
    dryRun: false,
    noInteractive: false,
    agents: [],
    ...overrides,
  };
}

export function defaultWatchOptions(overrides: Partial<WatchOptions> = {}): WatchOptions {
  return {
    ...defaultBuildOptions(),
    debounceMs: DEFAULT_DEBOUNCE_MS,
    ...overrides,
  };
}

export function resolveOutDir(out: string, cwd: string): string {
  return path.isAbsolute(out) ? out : path.resolve(cwd, out);
}
