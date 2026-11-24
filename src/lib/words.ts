/** "1 guest" / "3 guests" / "2 children". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Just the word: plural(3, "household") → "households". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
