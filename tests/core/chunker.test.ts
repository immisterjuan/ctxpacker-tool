import { describe, it, expect } from 'vitest';
import { rebalanceChunks } from '../../src/core/chunker.js';
import type { AstChunk } from '../../src/types.js';

function makeChunk(id: string, tokens: number, content?: string): AstChunk {
  const text = content ?? 'x'.repeat(tokens * 4);
  return {
    id,
    file: 'test.ts',
    startLine: 1,
    endLine: 10,
    estimatedTokens: tokens,
    content: text,
    kind: 'function',
    name: 'foo',
  };
}

describe('rebalanceChunks', () => {
  it('returns chunks that are already under the limit unchanged', () => {
    const chunks = [makeChunk('c1', 100), makeChunk('c2', 200)];
    const result = rebalanceChunks(chunks, 600);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('c1');
    expect(result[1]?.id).toBe('c2');
  });

  it('splits a chunk that exceeds maxTokens', () => {
    const bigContent = 'line content here\n'.repeat(200); // ~900 tokens
    const chunk = { ...makeChunk('big', 900, bigContent), content: bigContent };
    const result = rebalanceChunks([chunk], 200);

    expect(result.length).toBeGreaterThan(1);
    for (const c of result) {
      expect(c.estimatedTokens).toBeLessThanOrEqual(250); // some slack for last line
    }
  });

  it('preserves chunk metadata (file, kind, name) after split', () => {
    const bigContent = 'a '.repeat(1200);
    const chunk: AstChunk = { ...makeChunk('big2', 1200, bigContent), file: 'src/foo.ts', kind: 'class', name: 'Foo' };
    const result = rebalanceChunks([chunk], 300);

    for (const c of result) {
      expect(c.file).toBe('src/foo.ts');
      expect(c.kind).toBe('class');
      expect(c.name).toBe('Foo');
    }
  });

  it('reassembling split parts gives the same content as the original', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `const x${i} = ${i};`);
    const bigContent = lines.join('\n');
    const chunk: AstChunk = { ...makeChunk('big3', 2000, bigContent), content: bigContent };

    const result = rebalanceChunks([chunk], 100);
    const reassembled = result.map((c) => c.content).join('\n');
    // All original lines should be present
    for (const line of lines) {
      expect(reassembled).toContain(line);
    }
  });

  it('handles empty chunk list', () => {
    expect(rebalanceChunks([], 600)).toEqual([]);
  });
});
