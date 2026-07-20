import path from 'path';
import fs from 'fs';
import type { BuildOptions, DefinitionEntry, DependencyEntry, AstChunk } from '../types.js';
import {
  getPendingItems,
  setItemStatus,
  clearQueue,
} from '../queue/manager.js';
import { Analyzer } from '../core/analyzer.js';
import { rebalanceChunks } from '../core/chunker.js';
import { Writer } from '../core/writer.js';
import { buildAdapter } from '../core/adapters/index.js';
import { validateManifest, formatErrors } from '../schema/index.js';
import { fmt, print, printTable } from '../utils/format.js';
import { getLogger } from '../utils/logger.js';
import type { Manifest } from '../types.js';

export function runQueueList(packDir: string): void {
  const pending = getPendingItems(packDir);
  print(fmt.header('Pending queue items'));

  if (pending.length === 0) {
    print(fmt.dim('  No pending changes.'));
    return;
  }

  printTable(
    pending.map((item) => ({
      id: item.id,
      type: item.type,
      file: item.file,
      queued: item.timestamp,
    })),
  );
  print(fmt.dim(`\n  ${pending.length} item(s) pending approval`));
}

export async function runQueueApprove(
  idOrAll: string,
  packDir: string,
  buildOptions: BuildOptions,
): Promise<void> {
  const logger = getLogger();
  print(fmt.header('Approving queue items'));

  const approved = setItemStatus(packDir, idOrAll, 'approved');

  if (approved.length === 0) {
    print(fmt.warn('No pending items matched.'));
    return;
  }

  print(fmt.info(`Approved ${approved.length} item(s). Rebuilding affected files…`));

  // Load existing manifest
  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    print(fmt.error('manifest.json not found — run `build` first.'));
    process.exit(1);
  }

  const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!validateManifest(raw)) {
    print(fmt.error(`manifest.json invalid: ${formatErrors(validateManifest)}`));
    process.exit(1);
  }
  const manifest: Manifest = raw;

  // Re-analyze the specific changed files
  const changedFiles = approved
    .filter((i) => i.type !== 'delete')
    .map((i) => path.join(manifest.sourceRoot, i.file));

  const writer = new Writer(packDir, buildOptions.dryRun);
  writer.audit('info', 'queue.approve', { ids: approved.map((i) => i.id) });

  if (changedFiles.length > 0) {
    const changedRel = new Set(approved.map((i) => i.file));
    const analyzer = new Analyzer(manifest.sourceRoot, buildOptions.maxChunkTokens);
    const result = await analyzer.analyze(changedFiles);
    const chunks = rebalanceChunks(result.chunks, buildOptions.maxChunkTokens);

    const mergedDefs: DefinitionEntry[] = [
      ...(parseJsonlFile(path.join(packDir, 'definitions.jsonl')).filter(
        (d) => !changedRel.has(String(d['file'] ?? '')),
      ) as unknown as DefinitionEntry[]),
      ...result.definitions,
    ];

    const mergedDeps: DependencyEntry[] = [
      ...(parseJsonlFile(path.join(packDir, 'dependencies.jsonl')).filter(
        (d) => !changedRel.has(String(d['from'] ?? '')),
      ) as unknown as DependencyEntry[]),
      ...result.dependencies,
    ];

    const mergedChunks: AstChunk[] = [
      ...(parseJsonlFile(path.join(packDir, 'ast_chunks.jsonl')).filter(
        (d) => !changedRel.has(String(d['file'] ?? '')),
      ) as unknown as AstChunk[]),
      ...chunks,
    ];

    const updatedFiles = [
      ...manifest.files.filter((f) => !changedRel.has(f.path)),
      ...result.files,
    ].sort((a, b) => a.path.localeCompare(b.path));

    const updatedManifest: Manifest = {
      ...manifest,
      files: updatedFiles,
      stats: {
        totalFiles: updatedFiles.length,
        totalChunks: mergedChunks.length,
        estimatedTokens: mergedChunks.reduce((s, c) => s + c.estimatedTokens, 0),
      },
    };

    writer.writeManifest(updatedManifest);
    writer.writeDefinitions(mergedDefs);
    writer.writeDependencies(mergedDeps);
    writer.writeChunks(mergedChunks);

    for (const agent of manifest.agents) {
      const adapter = buildAdapter(agent, updatedManifest, mergedChunks, mergedDefs);
      writer.writeAdapter(agent, adapter);
    }
  }

  print(fmt.success(`Approved and integrated ${approved.length} change(s).`));
  logger.info({ event: 'queue.approved', count: approved.length });
}

export function runQueueReject(idOrAll: string, packDir: string): void {
  const rejected = setItemStatus(packDir, idOrAll, 'rejected');
  if (rejected.length === 0) {
    print(fmt.warn('No pending items matched.'));
    return;
  }
  print(fmt.success(`Rejected ${rejected.length} item(s).`));
  getLogger().info({ event: 'queue.rejected', count: rejected.length });
}

export function runQueueClear(packDir: string): void {
  const count = clearQueue(packDir);
  print(fmt.success(`Cleared ${count} item(s) from queue.`));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseJsonlFile(filePath: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
