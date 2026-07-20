import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Queue, QueueItem, QueueItemType, QueueItemStatus } from '../types.js';
import { validateQueue, formatErrors } from '../schema/index.js';
import { getLogger } from '../utils/logger.js';

const QUEUE_FILE = 'queue.json';

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function queuePath(packDir: string): string {
  return path.join(packDir, QUEUE_FILE);
}

export function readQueue(packDir: string): Queue {
  const p = queuePath(packDir);
  if (!fs.existsSync(p)) {
    return { version: '1', packDir, items: [] };
  }
  const raw = fs.readFileSync(p, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!validateQueue(parsed)) {
    throw new Error(`queue.json schema invalid: ${formatErrors(validateQueue)}`);
  }
  return parsed;
}

export function writeQueue(queue: Queue): void {
  fs.mkdirSync(queue.packDir, { recursive: true });
  fs.writeFileSync(
    queuePath(queue.packDir),
    JSON.stringify(queue, null, 2),
    'utf8',
  );
}

export function enqueueChange(
  packDir: string,
  file: string,
  type: QueueItemType,
): QueueItem {
  const queue = readQueue(packDir);
  const logger = getLogger();

  // deduplicate: update existing pending item for same file
  const existing = queue.items.find((i) => i.file === file && i.status === 'pending');
  if (existing) {
    existing.type = type;
    existing.timestamp = new Date().toISOString();
    writeQueue(queue);
    logger.info({ event: 'queue.update', file, type, id: existing.id }, 'queue item updated');
    return existing;
  }

  const item: QueueItem = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    file,
    status: 'pending',
  };
  queue.items.push(item);
  writeQueue(queue);
  logger.info({ event: 'queue.enqueue', file, type, id: item.id }, 'change queued (pending approval)');
  return item;
}

export function getPendingItems(packDir: string): QueueItem[] {
  return readQueue(packDir).items.filter((i) => i.status === 'pending');
}

export function setItemStatus(
  packDir: string,
  idOrAll: string,
  status: QueueItemStatus,
): QueueItem[] {
  const queue = readQueue(packDir);
  const affected: QueueItem[] = [];

  for (const item of queue.items) {
    if (item.status !== 'pending') continue;
    if (idOrAll === 'all' || item.id === idOrAll) {
      item.status = status;
      affected.push(item);
    }
  }

  writeQueue(queue);
  return affected;
}

export function clearQueue(packDir: string): number {
  const queue = readQueue(packDir);
  const count = queue.items.length;
  queue.items = [];
  writeQueue(queue);
  return count;
}

export function hasPendingItems(packDir: string): boolean {
  return getPendingItems(packDir).length > 0;
}
