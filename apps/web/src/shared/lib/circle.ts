/**
 * Index of the next element in a list that wraps around: after the last comes the first again.
 * This is how the factory floor plays a series of builds and the journal preloads the next one.
 * @param {number} index Index of the current element, zero-based.
 * @param {number} count Number of elements in the list; greater than zero.
 * @returns {number} Index of the next element, zero-based.
 */
export function nextIndexInCircle(index: number, count: number): number {
  return (index + 1) % count;
}
