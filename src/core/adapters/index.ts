import type { AgentAdapter, AgentName, AstChunk, DefinitionEntry, Manifest } from '../../types.js';
import { buildCopilotAdapter } from './copilot.js';
import { buildCursorAdapter } from './cursor.js';
import { buildClaudeAdapter } from './claude.js';
import { buildCodexAdapter } from './codex.js';
import { buildGeminiAdapter } from './gemini.js';

export type AdapterBuilder = (
  manifest: Manifest,
  chunks: AstChunk[],
  definitions: DefinitionEntry[],
) => AgentAdapter;

const REGISTRY: Record<AgentName, AdapterBuilder> = {
  copilot: buildCopilotAdapter,
  cursor: buildCursorAdapter,
  claude: buildClaudeAdapter,
  codex: buildCodexAdapter,
  gemini: buildGeminiAdapter,
};

export function buildAdapter(
  agent: AgentName,
  manifest: Manifest,
  chunks: AstChunk[],
  definitions: DefinitionEntry[],
): AgentAdapter {
  const builder = REGISTRY[agent];
  return builder(manifest, chunks, definitions);
}
