/**
 * Lightweight token estimator — suitable for budgeting without a full tokenizer.
 * Approximation: 1 token ≈ 4 characters (GPT/Claude empirical average for code).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function tokensToChars(tokens: number): number {
  return tokens * 4;
}
