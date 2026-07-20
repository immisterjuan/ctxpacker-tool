import type { AgentAdapter, AstChunk, DefinitionEntry, Manifest } from '../../types.js';

export function buildClaudeAdapter(
  manifest: Manifest,
  chunks: AstChunk[],
  definitions: DefinitionEntry[],
): AgentAdapter {
  return {
    agent: 'claude',
    format: 'anthropic-claude-context-v1',
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceRoot: manifest.sourceRoot,
    chunks,
    definitions,
    instructions: [
      'Context pack for Anthropic Claude.',
      'Provide `chunks` as <document> blocks and `definitions` for symbol resolution.',
      `TTL: ${manifest.ttlMinutes} minutes from ${manifest.createdAt}.`,
    ].join('\n'),
  };
}
