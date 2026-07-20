import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runVerify } from '../src/commands/verify.js';
import type { Manifest } from '../src/types.js';
import { validateManifest, validateQueue, formatErrors } from '../src/schema/index.js';

const FIXTURE = path.join(__dirname, 'fixtures', 'sample-ts', 'src');

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-schema-test-'));
}

function validManifest(sourceRoot = FIXTURE): Manifest {
  const now = new Date();
  const expires = new Date(now.getTime() + 120 * 60_000);
  return {
    version: '1',
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    ttlMinutes: 120,
    sourceRoot,
    files: [],
    agents: ['copilot'],
    stats: { totalFiles: 0, totalChunks: 0, estimatedTokens: 0 },
  };
}

describe('AJV schema validators', () => {
  it('accepts a valid manifest', () => {
    const ok = validateManifest(validManifest());
    expect(ok).toBe(true);
  });

  it('rejects manifest missing required fields', () => {
    const bad = { version: '1' };
    const ok = validateManifest(bad);
    expect(ok).toBe(false);
    expect(formatErrors(validateManifest)).toBeTruthy();
  });

  it('rejects manifest with wrong version', () => {
    const bad = { ...validManifest(), version: '2' };
    expect(validateManifest(bad)).toBe(false);
  });

  it('rejects manifest with hash not 64 chars', () => {
    const bad: Manifest = {
      ...validManifest(),
      files: [{ path: 'a.ts', hash: 'tooshort', size: 100, lastModified: new Date().toISOString() }],
    };
    expect(validateManifest(bad)).toBe(false);
  });

  it('accepts a valid queue', () => {
    const q = {
      version: '1',
      packDir: '/tmp/pack',
      items: [{ id: 'abc123', timestamp: new Date().toISOString(), type: 'modify', file: 'a.ts', status: 'pending' }],
    };
    expect(validateQueue(q)).toBe(true);
  });

  it('rejects queue with invalid item status', () => {
    const q = {
      version: '1',
      packDir: '/tmp/pack',
      items: [{ id: 'x', timestamp: new Date().toISOString(), type: 'modify', file: 'a.ts', status: 'unknown' }],
    };
    expect(validateQueue(q)).toBe(false);
  });
});

describe('verify command — fail-closed behaviour', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('fails when manifest.json is absent', () => {
    const result = runVerify(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason === 'file-missing')).toBe(true);
  });

  it('fails when manifest is schema-invalid', () => {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify({ bad: 'data' }), 'utf8');
    const result = runVerify(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason === 'schema-invalid')).toBe(true);
  });

  it('fails when pack is expired', () => {
    const expired: Manifest = {
      ...validManifest(FIXTURE),
      createdAt: new Date(Date.now() - 200 * 60_000).toISOString(),
      expiresAt: new Date(Date.now() - 80 * 60_000).toISOString(),
    };
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(expired), 'utf8');
    const result = runVerify(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason === 'expired')).toBe(true);
  });

  it('fails when a tracked file is missing from disk', () => {
    const m: Manifest = {
      ...validManifest(FIXTURE),
      files: [{
        path: 'nonexistent-file.ts',
        hash: 'a'.repeat(64),
        size: 100,
        lastModified: new Date().toISOString(),
      }],
    };
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(m), 'utf8');
    const result = runVerify(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason === 'file-missing')).toBe(true);
  });

  it('fails when a file hash does not match', () => {
    // Use a real file path but wrong hash
    const m: Manifest = {
      ...validManifest(FIXTURE),
      files: [{
        path: 'index.ts',
        hash: 'b'.repeat(64), // wrong hash
        size: 100,
        lastModified: new Date().toISOString(),
      }],
    };
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(m), 'utf8');
    const result = runVerify(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason === 'hash-mismatch')).toBe(true);
  });
});
