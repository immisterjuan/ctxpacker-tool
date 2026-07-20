import type { AgentAdapter, AstChunk, DefinitionEntry, Manifest } from '../../types.js';

export function buildCursorAdapter(
  manifest: Manifest,
  chunks: AstChunk[],
  definitions: DefinitionEntry[],
): AgentAdapter {
  return {
    agent: 'cursor',
    format: 'cursor-context-v1',
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceRoot: manifest.sourceRoot,
    chunks,
    definitions,
    instructions: [
      'Context pack for Cursor AI editor.',
      'Feed `chunks` into Cursor\'s codebase context and `definitions` for type-aware completions.',
      `Source root: ${manifest.sourceRoot}`,
    ].join('\n'),
  };
}
