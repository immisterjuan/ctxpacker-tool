import { describe, it, expect } from 'vitest';
import path from 'path';
import { Analyzer } from '../../src/core/analyzer.js';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'sample-ts', 'src');

describe('Analyzer', () => {
  it('discovers TypeScript files in the fixture directory', async () => {
    const analyzer = new Analyzer(FIXTURE, 600);
    const result = await analyzer.analyze();

    expect(result.files.length).toBeGreaterThanOrEqual(2);
    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.endsWith('index.ts'))).toBe(true);
    expect(paths.some((p) => p.endsWith('utils.ts'))).toBe(true);
  });

  it('extracts class, interface, function, type, and enum definitions', async () => {
    const analyzer = new Analyzer(FIXTURE, 600);
    const result = await analyzer.analyze();

    const names = result.definitions.map((d) => d.name);
    expect(names).toContain('App');
    expect(names).toContain('AppConfig');
    expect(names).toContain('greet');
    expect(names).toContain('add');
    expect(names).toContain('MathOp');
    expect(names).toContain('Direction');
  });

  it('marks exported symbols correctly', async () => {
    const analyzer = new Analyzer(FIXTURE, 600);
    const result = await analyzer.analyze();

    const appClass = result.definitions.find((d) => d.name === 'App');
    expect(appClass?.exported).toBe(true);

    const appConfig = result.definitions.find((d) => d.name === 'AppConfig');
    expect(appConfig?.exported).toBe(true);
  });

  it('extracts import dependencies', async () => {
    const analyzer = new Analyzer(FIXTURE, 600);
    const result = await analyzer.analyze();

    const dep = result.dependencies.find((d) => d.from.endsWith('index.ts'));
    expect(dep).toBeDefined();
    expect(dep?.symbols).toContain('greet');
    expect(dep?.symbols).toContain('add');
  });

  it('produces deterministic sorted output', async () => {
    const analyzer1 = new Analyzer(FIXTURE, 600);
    const analyzer2 = new Analyzer(FIXTURE, 600);

    const r1 = await analyzer1.analyze();
    const r2 = await analyzer2.analyze();

    expect(r1.definitions.map((d) => d.name)).toEqual(r2.definitions.map((d) => d.name));
    expect(r1.files.map((f) => f.path)).toEqual(r2.files.map((f) => f.path));
  });

  it('creates AST chunks with positive estimatedTokens', async () => {
    const analyzer = new Analyzer(FIXTURE, 600);
    const result = await analyzer.analyze();

    expect(result.chunks.length).toBeGreaterThan(0);
    for (const chunk of result.chunks) {
      expect(chunk.estimatedTokens).toBeGreaterThan(0);
      expect(typeof chunk.id).toBe('string');
    }
  });

  it('respects maxChunkTokens when chunking', async () => {
    const MAX = 100; // very small limit to force splitting
    const analyzer = new Analyzer(FIXTURE, MAX);
    const result = await analyzer.analyze();

    for (const chunk of result.chunks) {
      // Allow some slack (chunk may be slightly over if a line alone exceeds limit)
      expect(chunk.estimatedTokens).toBeLessThanOrEqual(MAX + 50);
    }
  });

  it('each file entry has a 64-char sha256 hash', async () => {
    const analyzer = new Analyzer(FIXTURE, 600);
    const result = await analyzer.analyze();

    for (const file of result.files) {
      expect(file.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
