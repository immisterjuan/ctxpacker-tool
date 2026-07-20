import path from 'path';
import type { BuildOptions, Manifest } from '../types.js';
import { resolveOutDir } from '../config.js';
import { Analyzer } from '../core/analyzer.js';
import { rebalanceChunks } from '../core/chunker.js';
import { Writer } from '../core/writer.js';
import { buildAdapter } from '../core/adapters/index.js';
import { getLogger } from '../utils/logger.js';
import { fmt, print } from '../utils/format.js';

export async function runBuild(
  targetPath: string,
  options: BuildOptions,
): Promise<void> {
  const logger = getLogger();
  const cwd = process.cwd();
  const sourceRoot = path.resolve(cwd, targetPath);
  const packDir = resolveOutDir(options.out, cwd);

  logger.info({ event: 'build.start', sourceRoot, packDir, agents: options.agents });
  print(fmt.header('Building context pack'));
  print(fmt.info(`Source: ${sourceRoot}`));
  print(fmt.info(`Output: ${packDir}`));
  print(fmt.info(`Agents: ${options.agents.join(', ')}`));

  const writer = new Writer(packDir, options.dryRun);
  writer.audit('info', 'build.start', { sourceRoot, agents: options.agents });

  const analyzer = new Analyzer(sourceRoot, options.maxChunkTokens);

  print(fmt.dim('  Analyzing source files…'));
  const result = await analyzer.analyze();
  const chunks = rebalanceChunks(result.chunks, options.maxChunkTokens);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.ttlMinutes * 60_000);
  const totalTokens = chunks.reduce((sum, c) => sum + c.estimatedTokens, 0);

  const manifest: Manifest = {
    version: '1',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttlMinutes: options.ttlMinutes,
    sourceRoot,
    files: result.files,
    agents: options.agents,
    stats: {
      totalFiles: result.files.length,
      totalChunks: chunks.length,
      estimatedTokens: totalTokens,
    },
  };

  if (!options.dryRun) {
    writer.writeManifest(manifest);
    writer.writeDefinitions(result.definitions);
    writer.writeDependencies(result.dependencies);
    writer.writeChunks(chunks);

    for (const agent of options.agents) {
      const adapter = buildAdapter(agent, manifest, chunks, result.definitions);
      writer.writeAdapter(agent, adapter);
    }
  }

  writer.audit('info', 'build.complete', {
    files: result.files.length,
    chunks: chunks.length,
    tokens: totalTokens,
  });

  print(fmt.success(`Build complete`));
  print(fmt.dim(`  Files: ${result.files.length}  Chunks: ${chunks.length}  ~Tokens: ${totalTokens}`));
  if (options.dryRun) print(fmt.warn('Dry-run mode — no files written.'));

  logger.info({ event: 'build.complete', files: result.files.length, chunks: chunks.length });
}
