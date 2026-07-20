import Ajv, { type ValidateFunction } from 'ajv';
import type { Manifest, Queue } from '../types.js';

const ajv = new Ajv({ allErrors: true, strict: false });

// ─── Manifest schema ───────────────────────────────────────────────────────────
const manifestSchema = {
  type: 'object',
  required: ['version', 'createdAt', 'expiresAt', 'ttlMinutes', 'sourceRoot', 'files', 'agents', 'stats'],
  properties: {
    version: { type: 'string', const: '1' },
    createdAt: { type: 'string' },
    expiresAt: { type: 'string' },
    ttlMinutes: { type: 'number', minimum: 1 },
    sourceRoot: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'hash', 'size', 'lastModified'],
        properties: {
          path: { type: 'string' },
          hash: { type: 'string', minLength: 64, maxLength: 64 },
          size: { type: 'number', minimum: 0 },
          lastModified: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    agents: { type: 'array', items: { type: 'string' } },
    stats: {
      type: 'object',
      required: ['totalFiles', 'totalChunks', 'estimatedTokens'],
      properties: {
        totalFiles: { type: 'number' },
        totalChunks: { type: 'number' },
        estimatedTokens: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

// ─── Queue schema ──────────────────────────────────────────────────────────────
const queueSchema = {
  type: 'object',
  required: ['version', 'packDir', 'items'],
  properties: {
    version: { type: 'string', const: '1' },
    packDir: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'timestamp', 'type', 'file', 'status'],
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string' },
          type: { type: 'string', enum: ['add', 'modify', 'delete'] },
          file: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

// ─── Compiled validators ───────────────────────────────────────────────────────
export const validateManifest: ValidateFunction<Manifest> = ajv.compile(manifestSchema);
export const validateQueue: ValidateFunction<Queue> = ajv.compile(queueSchema);

export function formatErrors(validate: ValidateFunction): string {
  return ajv.errorsText(validate.errors);
}
