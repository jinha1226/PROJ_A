/** 한국어 조사: 앞 글자의 받침에 맞춰 붙인다 (한글이 아니면 '이(가)'처럼 둘 다) */
type Pair = '이/가' | '을/를' | '은/는' | '과/와' | '으로/로';
export function josa(word: string, pair: Pair): string {
  const [a, b] = pair.split('/') as [string, string];
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}${a}(${b})`;
  const jong = (c - 0xac00) % 28;
  if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? b : a); // ㄹ 받침은 '로'
  return word + (jong ? a : b);
}

/** DCSS의 attack_strength_punctuation: 피해가 클수록 느낌표가 늘어난다 */
export function hitPunct(dmg: number): string {
  if (dmg < 7) return '.';
  if (dmg < 18) return '!';
  if (dmg < 36) return '!!';
  return '!'.repeat(3 + Math.floor(Math.log2(dmg / 36)));
}
