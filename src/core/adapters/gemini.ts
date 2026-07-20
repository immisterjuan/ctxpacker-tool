import type { AgentAdapter, AstChunk, DefinitionEntry, Manifest } from '../../types.js';

export function buildGeminiAdapter(
  manifest: Manifest,
  chunks: AstChunk[],
  definitions: DefinitionEntry[],
): AgentAdapter {
  return {
    agent: 'gemini',
    format: 'google-gemini-context-v1',
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceRoot: manifest.sourceRoot,
    chunks,
    definitions,
    instructions: [
      'Context pack for Google Gemini.',
      'Use `chunks` as grounding documents and `definitions` for code understanding.',
      `Expires: ${manifest.expiresAt}`,
    ].join('\n'),
  };
}
