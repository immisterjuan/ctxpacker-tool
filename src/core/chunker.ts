import type { AstChunk } from '../types.js';
import { estimateTokens } from '../utils/tokens.js';

/**
 * Re-splits a flat list of chunks to respect maxChunkTokens.
 * The Analyzer already produces chunks near the limit;
 * this is a safety pass for oversized ones.
 */
export function rebalanceChunks(chunks: AstChunk[], maxTokens: number): AstChunk[] {
  const result: AstChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.estimatedTokens <= maxTokens) {
      result.push(chunk);
      continue;
    }
    result.push(...splitChunk(chunk, maxTokens));
  }
  return result;
}

function splitChunk(chunk: AstChunk, maxTokens: number): AstChunk[] {
  const maxChars = maxTokens * 4;
  const lines = chunk.content.split('\n');
  const parts: AstChunk[] = [];

  let bufLines: string[] = [];
  let bufStart = chunk.startLine;
  let partIndex = 0;

  const flush = (): void => {
    if (bufLines.length === 0) return;
    const content = bufLines.join('\n');
    parts.push({
      ...chunk,
      id: `${chunk.id}_p${partIndex++}`,
      content,
      startLine: bufStart,
      endLine: bufStart + bufLines.length - 1,
      estimatedTokens: estimateTokens(content),
    });
    bufLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (bufLines.length > 0 && (bufLines.join('\n') + '\n' + line).length > maxChars) {
      flush();
      bufStart = chunk.startLine + i;
    }
    if (bufLines.length === 0) bufStart = chunk.startLine + i;
    bufLines.push(line);
  }
  flush();

  return parts;
}
