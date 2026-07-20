import fs from 'fs';
import path from 'path';
import type {
  Manifest,
  DefinitionEntry,
  DependencyEntry,
  AstChunk,
  AuditEntry,
  AuditLevel,
  AgentAdapter,
  AgentName,
} from '../types.js';

function jsonLine(obj: unknown): string {
  return JSON.stringify(obj) + '\n';
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export class Writer {
  private readonly packDir: string;
  private readonly dryRun: boolean;

  constructor(packDir: string, dryRun = false) {
    this.packDir = packDir;
    this.dryRun = dryRun;
  }

  private write(relPath: string, content: string): void {
    if (this.dryRun) return;
    const abs = path.join(this.packDir, relPath);
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, content, 'utf8');
  }

  writeManifest(manifest: Manifest): void {
    this.write('manifest.json', JSON.stringify(manifest, null, 2));
  }

  writeDefinitions(entries: DefinitionEntry[]): void {
    this.write('definitions.jsonl', entries.map(jsonLine).join(''));
  }

  writeDependencies(entries: DependencyEntry[]): void {
    this.write('dependencies.jsonl', entries.map(jsonLine).join(''));
  }

  writeChunks(chunks: AstChunk[]): void {
    this.write('ast_chunks.jsonl', chunks.map(jsonLine).join(''));
  }

  writeAdapter(agent: AgentName, adapter: AgentAdapter): void {
    this.write(
      path.join('adapters', `${agent}.json`),
      JSON.stringify(adapter, null, 2),
    );
  }

  appendAudit(entry: AuditEntry): void {
    if (this.dryRun) return;
    const abs = path.join(this.packDir, 'audit.log.jsonl');
    ensureDir(path.dirname(abs));
    fs.appendFileSync(abs, jsonLine(entry), 'utf8');
  }

  audit(level: AuditLevel, event: string, data?: Record<string, unknown>): void {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      level,
      event,
      ...(data !== undefined ? { data } : {}),
    };
    this.appendAudit(entry);
  }
}
