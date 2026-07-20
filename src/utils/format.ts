/**
 * Terminal output helpers — always write to process.stdout/stderr directly
 * so they are not captured by pino.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function color(code: string, text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${code}${text}${RESET}`;
}

export const fmt = {
  success: (t: string): string => color(GREEN + BOLD, `✔ ${t}`),
  warn: (t: string): string => color(YELLOW, `⚠ ${t}`),
  error: (t: string): string => color(RED + BOLD, `✖ ${t}`),
  info: (t: string): string => color(CYAN, `ℹ ${t}`),
  dim: (t: string): string => color(DIM, t),
  bold: (t: string): string => color(BOLD, t),
  header: (t: string): string => color(BOLD + CYAN, `\n── ${t} ──`),
};

export function print(msg: string): void {
  process.stdout.write(msg + '\n');
}

export function printTable(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) {
    print(fmt.dim('  (empty)'));
    return;
  }
  const keys = Object.keys(rows[0] ?? {});
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => (r[k] ?? '').length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i] ?? 0)).join('  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('  ');
  print(fmt.bold(header));
  print(fmt.dim(sep));
  for (const row of rows) {
    print(keys.map((k, i) => (row[k] ?? '').padEnd(widths[i] ?? 0)).join('  '));
  }
}
