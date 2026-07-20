import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  enqueueChange,
  getPendingItems,
  setItemStatus,
  clearQueue,
  readQueue,
} from '../../src/queue/manager.js';
import { runQueueReject, runQueueClear } from '../../src/commands/queue.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-queue-test-'));
}

describe('queue manager', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('setItemStatus approve', () => {
    it('approves a specific item by id', () => {
      const item = enqueueChange(tmpDir, 'src/a.ts', 'modify');
      const affected = setItemStatus(tmpDir, item.id, 'approved');

      expect(affected).toHaveLength(1);
      expect(affected[0]?.status).toBe('approved');

      const queue = readQueue(tmpDir);
      expect(queue.items.find((i) => i.id === item.id)?.status).toBe('approved');
    });

    it('approves all pending items when "all" is passed', () => {
      enqueueChange(tmpDir, 'src/a.ts', 'modify');
      enqueueChange(tmpDir, 'src/b.ts', 'add');
      enqueueChange(tmpDir, 'src/c.ts', 'delete');

      const affected = setItemStatus(tmpDir, 'all', 'approved');
      expect(affected).toHaveLength(3);

      const queue = readQueue(tmpDir);
      expect(queue.items.every((i) => i.status === 'approved')).toBe(true);
    });

    it('does not affect already-approved items', () => {
      const item = enqueueChange(tmpDir, 'src/a.ts', 'modify');
      setItemStatus(tmpDir, item.id, 'approved');

      // Enqueue a new one and approve all
      enqueueChange(tmpDir, 'src/b.ts', 'add');
      setItemStatus(tmpDir, 'all', 'approved');

      const queue = readQueue(tmpDir);
      expect(queue.items.filter((i) => i.status === 'approved')).toHaveLength(2);
    });

    it('returns empty array when no pending items match', () => {
      const result = setItemStatus(tmpDir, 'nonexistent-id', 'approved');
      expect(result).toHaveLength(0);
    });
  });

  describe('reject flow', () => {
    it('rejects a specific item by id', () => {
      const item = enqueueChange(tmpDir, 'src/a.ts', 'modify');
      const affected = setItemStatus(tmpDir, item.id, 'rejected');

      expect(affected[0]?.status).toBe('rejected');
      expect(getPendingItems(tmpDir)).toHaveLength(0);
    });

    it('rejects all pending items when "all" passed to runQueueReject', () => {
      enqueueChange(tmpDir, 'src/a.ts', 'modify');
      enqueueChange(tmpDir, 'src/b.ts', 'modify');

      runQueueReject('all', tmpDir);

      expect(getPendingItems(tmpDir)).toHaveLength(0);
      const queue = readQueue(tmpDir);
      expect(queue.items.every((i) => i.status === 'rejected')).toBe(true);
    });
  });

  describe('clear queue', () => {
    it('removes all items', () => {
      enqueueChange(tmpDir, 'src/a.ts', 'add');
      enqueueChange(tmpDir, 'src/b.ts', 'add');
      enqueueChange(tmpDir, 'src/c.ts', 'add');

      const count = clearQueue(tmpDir);
      expect(count).toBe(3);

      const queue = readQueue(tmpDir);
      expect(queue.items).toHaveLength(0);
    });

    it('runQueueClear also removes all items', () => {
      enqueueChange(tmpDir, 'src/x.ts', 'modify');
      runQueueClear(tmpDir);

      const queue = readQueue(tmpDir);
      expect(queue.items).toHaveLength(0);
    });
  });

  describe('read empty queue', () => {
    it('returns empty items for a new pack dir', () => {
      const queue = readQueue(tmpDir);
      expect(queue.version).toBe('1');
      expect(queue.items).toHaveLength(0);
    });
  });
});
