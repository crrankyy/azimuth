/** Jitter sources for tests: full jitter multiplies the cap by a draw from [0, 1]. */
export const upperBound = (): number => 1;
export const lowerBound = (): number => 0;

export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}
