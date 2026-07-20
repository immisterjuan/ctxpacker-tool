import type { AgentAdapter, AstChunk, DefinitionEntry, Manifest } from '../../types.js';

export function buildCodexAdapter(
  manifest: Manifest,
  chunks: AstChunk[],
  definitions: DefinitionEntry[],
): AgentAdapter {
  return {
    agent: 'codex',
    format: 'openai-codex-context-v1',
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceRoot: manifest.sourceRoot,
    chunks,
    definitions,
    instructions: [
      'Context pack for OpenAI Codex / GPT-4o.',
      'Supply `chunks` as system-message code blocks.',
      `Files: ${manifest.stats.totalFiles}  Chunks: ${manifest.stats.totalChunks}  ~Tokens: ${manifest.stats.estimatedTokens}`,
    ].join('\n'),
  };
}
