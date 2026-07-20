#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import pkg from '../package.json';
import { ALL_AGENTS, type AgentName } from './types.js';
import { DEFAULT_OUT_DIR, DEFAULT_TTL_MINUTES, DEFAULT_MAX_CHUNK_TOKENS, DEFAULT_DEBOUNCE_MS } from './config.js';
import { runBuild } from './commands/build.js';
import { runWatch } from './commands/watch.js';
import { runVerify } from './commands/verify.js';
import {
  runQueueList,
  runQueueApprove,
  runQueueReject,
  runQueueClear,
} from './commands/queue.js';
import { fmt, print } from './utils/format.js';

// ─── Agent flag helpers ────────────────────────────────────────────────────────
interface AgentFlags {
  copilot?: boolean;
  cursor?: boolean;
  claude?: boolean;
  codex?: boolean;
  gemini?: boolean;
  all?: boolean;
}

function resolveAgents(flags: AgentFlags): AgentName[] {
  if (flags.all) return [...ALL_AGENTS];
  const selected: AgentName[] = [];
  if (flags.copilot) selected.push('copilot');
  if (flags.cursor) selected.push('cursor');
  if (flags.claude) selected.push('claude');
  if (flags.codex) selected.push('codex');
  if (flags.gemini) selected.push('gemini');
  return selected;
}

function requireAgents(flags: AgentFlags, cmd: Command): AgentName[] {
  const agents = resolveAgents(flags);
  if (agents.length === 0) {
    print(fmt.error('At least one agent flag is required (--copilot, --cursor, --claude, --codex, --gemini, --all)'));
    cmd.help();
  }
  return agents;
}

// ─── Shared option adders ──────────────────────────────────────────────────────
function addAgentFlags(cmd: Command): Command {
  return cmd
    .option('--copilot', 'Generate GitHub Copilot adapter')
    .option('--cursor', 'Generate Cursor adapter')
    .option('--claude', 'Generate Claude adapter')
    .option('--codex', 'Generate OpenAI Codex adapter')
    .option('--gemini', 'Generate Google Gemini adapter')
    .option('--all', 'Generate all agent adapters');
}

function addBuildFlags(cmd: Command): Command {
  return addAgentFlags(cmd)
    .option('--out <dir>', 'Output directory', DEFAULT_OUT_DIR)
    .option('--ttl-minutes <n>', 'Pack TTL in minutes', String(DEFAULT_TTL_MINUTES))
    .option('--max-chunk-tokens <n>', 'Max tokens per chunk', String(DEFAULT_MAX_CHUNK_TOKENS))
    .option('--changed-only', 'Only process changed files')
    .option('--dry-run', 'Print what would be done without writing files')
    .option('--no-interactive', 'Disable interactive prompts');
}

// ─── Program ───────────────────────────────────────────────────────────────────
const program = new Command()
  .name('ctxpacker-tool')
  .version(pkg.version)
  .description(pkg.description)
  .addHelpText('after', `
Examples:
  $ ctxpacker-tool build . --copilot --cursor
  $ ctxpacker-tool build ./src --all --out .agent-cache/pack
  $ ctxpacker-tool watch . --copilot
  $ ctxpacker-tool queue list --pack .agent-cache/context-pack
  $ ctxpacker-tool queue approve all --pack .agent-cache/context-pack
  $ ctxpacker-tool verify --pack .agent-cache/context-pack
`);

// ─── build ─────────────────────────────────────────────────────────────────────
const buildCmd = new Command('build')
  .description('Analyze source and generate a context pack')
  .argument('[path]', 'Source directory to analyze', '.')
  .action(async (targetPath: string, _opts: unknown, cmd: Command) => {
    const opts = cmd.opts<AgentFlags & {
      out: string;
      ttlMinutes: string;
      maxChunkTokens: string;
      changedOnly?: boolean;
      dryRun?: boolean;
      noInteractive?: boolean;
    }>();
    const agents = requireAgents(opts, cmd);
    await runBuild(targetPath, {
      agents,
      out: opts.out,
      ttlMinutes: parseInt(opts.ttlMinutes, 10),
      maxChunkTokens: parseInt(opts.maxChunkTokens, 10),
      changedOnly: opts.changedOnly ?? false,
      dryRun: opts.dryRun ?? false,
      noInteractive: opts.noInteractive ?? false,
    });
  });

addBuildFlags(buildCmd);
program.addCommand(buildCmd);

// ─── watch ─────────────────────────────────────────────────────────────────────
const watchCmd = new Command('watch')
  .description('Watch source directory and queue changes for approval')
  .argument('[path]', 'Source directory to watch', '.')
  .option('--debounce-ms <n>', 'Debounce delay in milliseconds', String(DEFAULT_DEBOUNCE_MS))
  .action(async (targetPath: string, _opts: unknown, cmd: Command) => {
    const opts = cmd.opts<AgentFlags & {
      out: string;
      ttlMinutes: string;
      maxChunkTokens: string;
      changedOnly?: boolean;
      dryRun?: boolean;
      noInteractive?: boolean;
      debounceMs: string;
    }>();
    const agents = requireAgents(opts, cmd);
    await runWatch(targetPath, {
      agents,
      out: opts.out,
      ttlMinutes: parseInt(opts.ttlMinutes, 10),
      maxChunkTokens: parseInt(opts.maxChunkTokens, 10),
      changedOnly: opts.changedOnly ?? false,
      dryRun: opts.dryRun ?? false,
      noInteractive: opts.noInteractive ?? false,
      debounceMs: parseInt(opts.debounceMs, 10),
    });
  });

addBuildFlags(watchCmd);
program.addCommand(watchCmd);

// ─── verify ────────────────────────────────────────────────────────────────────
program
  .command('verify')
  .description('Verify a context pack for integrity, schema, and TTL')
  .requiredOption('--pack <dir>', 'Path to the context pack directory')
  .action((opts: { pack: string }) => {
    const result = runVerify(path.resolve(process.cwd(), opts.pack));
    if (!result.valid) process.exit(1);
  });

// ─── queue ─────────────────────────────────────────────────────────────────────
const queueCmd = new Command('queue').description('Manage the change queue');

queueCmd
  .command('list')
  .description('List pending queue items')
  .requiredOption('--pack <dir>', 'Path to the context pack directory')
  .action((opts: { pack: string }) => {
    runQueueList(path.resolve(process.cwd(), opts.pack));
  });

queueCmd
  .command('approve <id>')
  .description('Approve and integrate a queued change (use "all" for all pending)')
  .requiredOption('--pack <dir>', 'Path to the context pack directory')
  .option('--out <dir>', 'Output directory', DEFAULT_OUT_DIR)
  .option('--max-chunk-tokens <n>', 'Max tokens per chunk', String(DEFAULT_MAX_CHUNK_TOKENS))
  .action(async (id: string, opts: { pack: string; out: string; maxChunkTokens: string }) => {
    await runQueueApprove(id, path.resolve(process.cwd(), opts.pack), {
      agents: [],
      out: opts.out,
      ttlMinutes: DEFAULT_TTL_MINUTES,
      maxChunkTokens: parseInt(opts.maxChunkTokens, 10),
      changedOnly: false,
      dryRun: false,
      noInteractive: true,
    });
  });

queueCmd
  .command('reject <id>')
  .description('Reject a queued change (use "all" for all pending)')
  .requiredOption('--pack <dir>', 'Path to the context pack directory')
  .action((id: string, opts: { pack: string }) => {
    runQueueReject(id, path.resolve(process.cwd(), opts.pack));
  });

queueCmd
  .command('clear')
  .description('Clear all items from the queue')
  .requiredOption('--pack <dir>', 'Path to the context pack directory')
  .action((opts: { pack: string }) => {
    runQueueClear(path.resolve(process.cwd(), opts.pack));
  });

program.addCommand(queueCmd);

// ─── Parse ─────────────────────────────────────────────────────────────────────
program.parse(process.argv);
