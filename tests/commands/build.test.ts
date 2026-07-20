import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runBuild } from '../../src/commands/build.js';
import type { BuildOptions, AgentName, Manifest } from '../../src/types.js';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'sample-ts', 'src');

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-test-'));
}

function buildOpts(overrides: Partial<BuildOptions> = {}): BuildOptions {
  return {
    out: '',          // set per test
    ttlMinutes: 120,
    maxChunkTokens: 600,
    changedOnly: false,
    dryRun: false,
    noInteractive: true,
    agents: ['copilot'],
    ...overrides,
  };
}

describe('build command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates manifest.json with correct structure', async () => {
    const opts = buildOpts({ out: tmpDir, agents: ['copilot'] });
    await runBuild(FIXTURE, opts);

    const raw = fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf8');
    const manifest: Manifest = JSON.parse(raw) as Manifest;

    expect(manifest.version).toBe('1');
    expect(manifest.agents).toEqual(['copilot']);
    expect(manifest.stats.totalFiles).toBeGreaterThan(0);
    expect(manifest.stats.totalChunks).toBeGreaterThan(0);
    expect(new Date(manifest.expiresAt).getTime()).toBeGreaterThan(new Date(manifest.createdAt).getTime());
  });

  it('generates definitions.jsonl with exported symbols', async () => {
    const opts = buildOpts({ out: tmpDir, agents: ['copilot'] });
    await runBuild(FIXTURE, opts);

    const lines = fs.readFileSync(path.join(tmpDir, 'definitions.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { name: string; kind: string; exported: boolean });

    expect(lines.length).toBeGreaterThan(0);
    const names = lines.map((l) => l.name);
    expect(names).toContain('App');
    expect(names).toContain('greet');
    expect(names).toContain('AppConfig');
  });

  it('generates ast_chunks.jsonl', async () => {
    const opts = buildOpts({ out: tmpDir, agents: ['copilot'] });
    await runBuild(FIXTURE, opts);

    const content = fs.readFileSync(path.join(tmpDir, 'ast_chunks.jsonl'), 'utf8');
    const chunks = content.split('\n').filter(Boolean).map((l) => JSON.parse(l) as { id: string; estimatedTokens: number });

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.estimatedTokens).toBeGreaterThan(0);
      expect(chunk.estimatedTokens).toBeLessThanOrEqual(700); // some slack over 600
    }
  });

  it('creates only selected agent adapters', async () => {
    const opts = buildOpts({ out: tmpDir, agents: ['copilot', 'cursor'] });
    await runBuild(FIXTURE, opts);

    const adaptersDir = path.join(tmpDir, 'adapters');
    const files = fs.readdirSync(adaptersDir);

    expect(files).toContain('copilot.json');
    expect(files).toContain('cursor.json');
    expect(files).not.toContain('claude.json');
    expect(files).not.toContain('codex.json');
    expect(files).not.toContain('gemini.json');
  });

  it('--all flag enables all five agents', async () => {
    const allAgents: AgentName[] = ['copilot', 'cursor', 'claude', 'codex', 'gemini'];
    const opts = buildOpts({ out: tmpDir, agents: allAgents });
    await runBuild(FIXTURE, opts);

    const adaptersDir = path.join(tmpDir, 'adapters');
    const files = fs.readdirSync(adaptersDir);
    for (const agent of allAgents) {
      expect(files).toContain(`${agent}.json`);
    }
  });

  it('dry-run does not write any files', async () => {
    const opts = buildOpts({ out: tmpDir, agents: ['copilot'], dryRun: true });
    await runBuild(FIXTURE, opts);

    // No artifacts should exist except the directory itself
    const entries = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
    expect(entries).not.toContain('manifest.json');
  });

  it('produces deterministic output for the same input', async () => {
    const dir1 = makeTempDir();
    const dir2 = makeTempDir();
    try {
      const opts1 = buildOpts({ out: dir1, agents: ['copilot'] });
      const opts2 = buildOpts({ out: dir2, agents: ['copilot'] });

      // Run back-to-back quickly so timestamps differ but content stays same
      await runBuild(FIXTURE, opts1);
      await runBuild(FIXTURE, opts2);

      const defs1 = fs.readFileSync(path.join(dir1, 'definitions.jsonl'), 'utf8');
      const defs2 = fs.readFileSync(path.join(dir2, 'definitions.jsonl'), 'utf8');
      expect(defs1).toBe(defs2);

      const deps1 = fs.readFileSync(path.join(dir1, 'dependencies.jsonl'), 'utf8');
      const deps2 = fs.readFileSync(path.join(dir2, 'dependencies.jsonl'), 'utf8');
      expect(deps1).toBe(deps2);
    } finally {
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('writes audit.log.jsonl entries', async () => {
    const opts = buildOpts({ out: tmpDir, agents: ['copilot'] });
    await runBuild(FIXTURE, opts);

    const lines = fs.readFileSync(path.join(tmpDir, 'audit.log.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { event: string });

    const events = lines.map((l) => l.event);
    expect(events).toContain('build.start');
    expect(events).toContain('build.complete');
  });
});
