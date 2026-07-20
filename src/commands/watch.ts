import path from 'path';
import chokidar from 'chokidar';
import type { WatchOptions, QueueItemType } from '../types.js';
import { resolveOutDir } from '../config.js';
import { enqueueChange, getPendingItems } from '../queue/manager.js';
import { Writer } from '../core/writer.js';
import { getLogger } from '../utils/logger.js';
import { fmt, print } from '../utils/format.js';

export async function runWatch(
  targetPath: string,
  options: WatchOptions,
): Promise<void> {
  const logger = getLogger();
  const cwd = process.cwd();
  const sourceRoot = path.resolve(cwd, targetPath);
  const packDir = resolveOutDir(options.out, cwd);

  print(fmt.header('Watch mode'));
  print(fmt.info(`Watching: ${sourceRoot}`));
  print(fmt.info(`Pack dir: ${packDir}`));
  print(fmt.warn('Changes will be QUEUED — they require explicit approval.'));
  print(fmt.dim('  Use: ctxpacker-tool queue approve all --pack <dir>'));

  const writer = new Writer(packDir);
  writer.audit('info', 'watch.start', { sourceRoot, debounceMs: options.debounceMs });

  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = chokidar.watch(sourceRoot, {
    persistent: true,
    ignoreInitial: true,
    ignored: [
      /node_modules/,
      /\.git/,
      /dist\//,
      /\.d\.ts$/,
    ],
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  });

  function scheduleQueue(filePath: string, type: QueueItemType): void {
    const rel = path.relative(sourceRoot, filePath);
    const existing = pendingTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      pendingTimers.delete(filePath);
      try {
        const item = enqueueChange(packDir, rel, type);
        print(fmt.warn(`Queued [${item.id}] ${type}: ${rel}`));
        writer.audit('info', 'queue.enqueue', { file: rel, type, id: item.id });

        const pending = getPendingItems(packDir);
        print(fmt.dim(`  ${pending.length} change(s) pending approval`));
      } catch (err) {
        logger.error({ event: 'queue.error', filePath, err });
      }
    }, options.debounceMs);

    pendingTimers.set(filePath, timer);
  }

  watcher
    .on('add', (fp) => scheduleQueue(fp, 'add'))
    .on('change', (fp) => scheduleQueue(fp, 'modify'))
    .on('unlink', (fp) => scheduleQueue(fp, 'delete'))
    .on('error', (err) => logger.error({ event: 'watcher.error', err }));

  logger.info({ event: 'watch.ready', sourceRoot });

  // Keep the process alive
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      print(fmt.dim('\n  Watch mode exiting…'));
      writer.audit('info', 'watch.stop', {});
      void watcher.close().then(resolve);
    });
    process.on('SIGTERM', () => {
      void watcher.close().then(resolve);
    });
  });
}
