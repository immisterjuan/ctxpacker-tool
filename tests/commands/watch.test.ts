import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  enqueueChange,
  getPendingItems,
  readQueue,
} from '../../src/queue/manager.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-watch-test-'));
}

describe('watch mode queue behaviour', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('enqueueChange creates a pending queue item', () => {
    const item = enqueueChange(tmpDir, 'src/index.ts', 'modify');

    expect(item.status).toBe('pending');
    expect(item.type).toBe('modify');
    expect(item.file).toBe('src/index.ts');
    expect(typeof item.id).toBe('string');
    expect(item.id.length).toBeGreaterThan(0);
  });

  it('queue.json is created on first enqueue', () => {
    enqueueChange(tmpDir, 'src/utils.ts', 'add');
    expect(fs.existsSync(path.join(tmpDir, 'queue.json'))).toBe(true);
  });

  it('pending items are not auto-applied to pack artifacts', () => {
    enqueueChange(tmpDir, 'src/index.ts', 'modify');

    // No manifest should be written by watch/queue
    expect(fs.existsSync(path.join(tmpDir, 'manifest.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'definitions.jsonl'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'ast_chunks.jsonl'))).toBe(false);
  });

  it('multiple changes to same file deduplicate to one pending item', () => {
    enqueueChange(tmpDir, 'src/index.ts', 'add');
    enqueueChange(tmpDir, 'src/index.ts', 'modify');
    enqueueChange(tmpDir, 'src/index.ts', 'modify');

    const pending = getPendingItems(tmpDir);
    const forFile = pending.filter((i) => i.file === 'src/index.ts');
    expect(forFile.length).toBe(1);
    expect(forFile[0]?.type).toBe('modify');
  });

  it('different files create separate queue items', () => {
    enqueueChange(tmpDir, 'src/index.ts', 'modify');
    enqueueChange(tmpDir, 'src/utils.ts', 'modify');

    const pending = getPendingItems(tmpDir);
    expect(pending.length).toBe(2);
  });

  it('queue persists between reads', () => {
    enqueueChange(tmpDir, 'src/a.ts', 'add');
    enqueueChange(tmpDir, 'src/b.ts', 'add');

    // Simulate a fresh read (as a new process would do)
    const queue = readQueue(tmpDir);
    expect(queue.items.length).toBe(2);
    expect(queue.version).toBe('1');
  });
});
