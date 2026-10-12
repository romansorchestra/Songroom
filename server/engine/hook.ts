// Where the title lands in an idea's lines (11 Oct 2026, late). Sam: the few lines should
// be built around the title, the way it would be used in the chorus; some should start
// with the title, some end with it, some have it in passing. The engine assigns each idea
// one of the three and checks the title is really in the lines; a block without its title
// goes back with the rhyme retry.

export type Hook = 'open' | 'close' | 'passing';
export const HOOKS: Hook[] = ['open', 'close', 'passing'];

/** For the brief: one line each, in the writer's terms. */
export const HOOK_NOTE: Record<Hook, string> = {
  open: 'the title opens the block: the first line starts with it',
  close: 'the block lands on the title: the last line ends with it',
  passing: 'the title is said in passing: inside one of the lines, not opening the first and not ending the last',
};

/** Spread the three placements over a batch so they vary, starting from a different one each time. */
export function assignHooks(count: number, start = Math.floor(Math.random() * HOOKS.length)): Hook[] {
  return Array.from({ length: count }, (_, i) => HOOKS[(start + i) % HOOKS.length]);
}

const norm = (s: string) => s.toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Where the title actually sits in these lines, or 'none' when it isn't there. */
export function hookPlacement(title: string, lines: string[]): Hook | 'none' {
  const t = norm(title);
  const ls = lines.map(norm).filter(Boolean);
  if (!t || !ls.length) return 'none';
  const has = (l: string) => ` ${l} `.includes(` ${t} `);
  if (!ls.some(has)) return 'none';
  if (ls[0].startsWith(t + ' ') || ls[0] === t) return 'open';
  if (ls[ls.length - 1].endsWith(' ' + t) || ls[ls.length - 1] === t) return 'close';
  return 'passing';
}
