// ─── Agent names ───────────────────────────────────────────────────────────────
export type AgentName = 'copilot' | 'cursor' | 'claude' | 'codex' | 'gemini';
export const ALL_AGENTS: AgentName[] = ['copilot', 'cursor', 'claude', 'codex', 'gemini'];

// ─── CLI option shapes ─────────────────────────────────────────────────────────
export interface BuildOptions {
  out: string;
  ttlMinutes: number;
  maxChunkTokens: number;
  changedOnly: boolean;
  dryRun: boolean;
  noInteractive: boolean;
  agents: AgentName[];
}

export interface WatchOptions extends BuildOptions {
  debounceMs: number;
}

// ─── Manifest ──────────────────────────────────────────────────────────────────
export interface ManifestFile {
  path: string;
  hash: string;
  size: number;
  lastModified: string;
}

export interface ManifestStats {
  totalFiles: number;
  totalChunks: number;
  estimatedTokens: number;
}

export interface Manifest {
  version: '1';
  createdAt: string;
  expiresAt: string;
  ttlMinutes: number;
  sourceRoot: string;
  files: ManifestFile[];
  agents: AgentName[];
  stats: ManifestStats;
}

// ─── Analysis artifacts ────────────────────────────────────────────────────────
export type DefinitionKind =
  | 'class'
  | 'interface'
  | 'type'
  | 'function'
  | 'variable'
  | 'enum';

export interface DefinitionEntry {
  file: string;
  kind: DefinitionKind;
  name: string;
  exported: boolean;
  startLine: number;
  endLine: number;
  text: string;
}

export type DependencyKind = 'import' | 'require';

export interface DependencyEntry {
  from: string;
  to: string;
  kind: DependencyKind;
  symbols: string[];
}

export interface AstChunk {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  estimatedTokens: number;
  content: string;
  kind: string;
  name: string | null;
}

// ─── Queue ─────────────────────────────────────────────────────────────────────
export type QueueItemType = 'add' | 'modify' | 'delete';
export type QueueItemStatus = 'pending' | 'approved' | 'rejected';

export interface QueueItem {
  id: string;
  timestamp: string;
  type: QueueItemType;
  file: string;
  status: QueueItemStatus;
}

export interface Queue {
  version: '1';
  packDir: string;
  items: QueueItem[];
}

// ─── Audit ─────────────────────────────────────────────────────────────────────
export type AuditLevel = 'info' | 'warn' | 'error';

export interface AuditEntry {
  ts: string;
  level: AuditLevel;
  event: string;
  data?: Record<string, unknown>;
}

// ─── Agent adapter ─────────────────────────────────────────────────────────────
export interface AgentAdapter {
  agent: AgentName;
  format: string;
  version: string;
  generatedAt: string;
  sourceRoot: string;
  chunks: AstChunk[];
  definitions: DefinitionEntry[];
  instructions: string;
}

// ─── Analysis result (returned by Analyzer) ───────────────────────────────────
export interface AnalysisResult {
  definitions: DefinitionEntry[];
  dependencies: DependencyEntry[];
  chunks: AstChunk[];
  files: ManifestFile[];
}

// ─── Verify result ─────────────────────────────────────────────────────────────
export type VerifyFailReason =
  | 'expired'
  | 'hash-mismatch'
  | 'schema-invalid'
  | 'file-missing';

export interface VerifyResult {
  valid: boolean;
  failures: Array<{ reason: VerifyFailReason; detail: string }>;
}
