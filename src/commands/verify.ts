import fs from 'fs';
import path from 'path';
import type { Manifest, VerifyResult, VerifyFailReason } from '../types.js';
import { validateManifest, formatErrors } from '../schema/index.js';
import { hashFile } from '../utils/hash.js';
import { fmt, print, printTable } from '../utils/format.js';
import { getLogger } from '../utils/logger.js';

export function runVerify(packDir: string): VerifyResult {
  const logger = getLogger();
  print(fmt.header('Verifying context pack'));
  print(fmt.info(`Pack: ${packDir}`));

  const failures: Array<{ reason: VerifyFailReason; detail: string }> = [];

  // ── 1. Manifest exists ───────────────────────────────────────────────────────
  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    failures.push({ reason: 'file-missing', detail: 'manifest.json not found' });
    print(fmt.error('manifest.json not found'));
    return { valid: false, failures };
  }

  // ── 2. Schema validation ─────────────────────────────────────────────────────
  let manifest: Manifest;
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!validateManifest(raw)) {
      const msg = formatErrors(validateManifest);
      failures.push({ reason: 'schema-invalid', detail: msg });
      print(fmt.error(`Schema invalid: ${msg}`));
      return { valid: false, failures };
    }
    manifest = raw;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    failures.push({ reason: 'schema-invalid', detail: msg });
    print(fmt.error(`Cannot parse manifest: ${msg}`));
    return { valid: false, failures };
  }

  // ── 3. TTL / expiry ──────────────────────────────────────────────────────────
  const expiresAt = new Date(manifest.expiresAt);
  if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    failures.push({ reason: 'expired', detail: `Pack expired at ${manifest.expiresAt}` });
    print(fmt.warn(`Pack expired at ${manifest.expiresAt}`));
  }

  // ── 4. File hash integrity ───────────────────────────────────────────────────
  let hashOk = 0;
  let hashFail = 0;

  for (const entry of manifest.files) {
    const absPath = path.join(manifest.sourceRoot, entry.path);
    if (!fs.existsSync(absPath)) {
      failures.push({ reason: 'file-missing', detail: entry.path });
      hashFail++;
      continue;
    }
    const actual = hashFile(absPath);
    if (actual !== entry.hash) {
      failures.push({ reason: 'hash-mismatch', detail: `${entry.path} (expected ${entry.hash.slice(0, 8)}… got ${actual.slice(0, 8)}…)` });
      hashFail++;
    } else {
      hashOk++;
    }
  }

  print(fmt.dim(`  Files: ${hashOk} ok, ${hashFail} failed`));

  const valid = failures.length === 0;

  if (valid) {
    print(fmt.success('Pack is valid'));
  } else {
    print(fmt.error(`Pack has ${failures.length} failure(s):`));
    printTable(failures.map((f) => ({ reason: f.reason, detail: f.detail })));
  }

  logger.info({ event: 'verify.complete', valid, failures: failures.length });
  return { valid, failures };
}
