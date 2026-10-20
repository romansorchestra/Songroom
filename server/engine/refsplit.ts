// "Noah Kahan, Sam Fender" is two references. Before 19 Oct 2026 the research pack's first
// matching profile silently stood in for the whole query, so Sam Fender disappeared. This
// splits a typed reference into the pack profiles it names and whatever is left over, which
// is looked up on its own. Titles and names that contain a comma or "and" ("Tyler, the
// Creator", "Good Luck, Babe!") stay whole when the pack knows them; anything the pack does
// not know is left to the lookup, which can answer "several" itself.

import type { Profile } from './pack.js';

export function normRef(q: string): string {
  return q.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const SEP = /(\s*[,;/+&]\s*|\s+and\s+|\s+x\s+|\s+with\s+|\s+vs\.?\s+|\s+plus\s+)/i;
// Words around a name that don't change which reference it is.
const FILLER = /^(?:(?:something|a bit|kind of|sort of|songs?|stuff|vibes?|in the (?:style|vein|spirit) of|like|think|more|early|late|old|new|the)\s+)+|(?:\s+(?:era|vibes?|style|type|energy|feel|songs?|stuff|records?))+$/g;

const has = (hay: string, needle: string) => !!needle && (` ${hay} `).includes(` ${needle} `);

type Hit = { profile: Profile; strong: boolean };

/** Which profile an item names. A profile's own name or a multi-word alias counts anywhere in
 *  the item; a one-word alias ("Messy", "Play", "Nashville") only when it is the whole item,
 *  and a song in its sample only when that profile is named elsewhere too (weak). */
function hitsFor(item: string, profiles: Profile[]): Hit[] {
  const n = normRef(item);
  const bare = n.replace(FILLER, '').trim();
  const out: Hit[] = [];
  for (const p of profiles) {
    const name = normRef(p.name.replace(/\(.*\)/, ''));
    const aliases = (p.aliases ?? []).map(normRef).filter(Boolean);
    const strong = has(n, name) || aliases.some((a) => (a.includes(' ') ? has(n, a) : a === bare || a === n));
    if (strong) { out.push({ profile: p, strong: true }); continue; }
    if ((p.sample ?? []).map(normRef).some((t) => t && (t === bare || t === n))) out.push({ profile: p, strong: false });
  }
  return out;
}

export type RefSplit = { profiles: Profile[]; rest: string[] };

/** The pack profiles a query names, in order, and the leftover items to look up. When the
 *  query names no pack profile at all, nothing is split: the lookup sees the whole query. */
export function splitReference(query: string, profiles: Profile[]): RefSplit {
  const parts = query.split(SEP);
  const items: string[] = [];
  const seps: string[] = [];
  for (let i = 0; i < parts.length; i++) (i % 2 ? seps : items).push(parts[i]);
  // Re-join neighbours that only together make a name the pack knows ("Tyler" + "the Creator").
  const known = profiles.flatMap((p) => [normRef(p.name.replace(/\(.*\)/, '')), ...(p.aliases ?? []).map(normRef), ...(p.sample ?? []).map(normRef)]).filter((s) => s.includes(' '));
  for (let changed = true; changed;) {
    changed = false;
    for (let k = 0; k + 1 < items.length; k++) {
      const a = normRef(items[k]), b = normRef(items[k + 1]), ab = normRef(items[k] + seps[k] + items[k + 1]);
      if (known.some((s) => has(ab, s) && !has(a, s) && !has(b, s))) {
        items.splice(k, 2, items[k] + seps[k] + items[k + 1]); seps.splice(k, 1); changed = true; break;
      }
    }
  }
  const named: Profile[] = [];
  const weak: Array<{ item: string; ps: Profile[] }> = [];
  const rest: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!/\p{L}{2}/u.test(item)) continue;
    const hits = hitsFor(item, profiles);
    const strong = hits.filter((h) => h.strong).map((h) => h.profile);
    if (strong.length) { for (const p of strong) if (!named.includes(p)) named.push(p); }
    else if (hits.length) weak.push({ item, ps: hits.map((h) => h.profile) });
    else rest.push(item);
  }
  if (!named.length) return { profiles: [], rest: [query.trim()] };
  // A song title belongs to an artist named alongside it ("Espresso, Sabrina Carpenter"); otherwise look it up.
  for (const w of weak) if (!w.ps.some((p) => named.includes(p))) rest.push(w.item);
  return { profiles: named, rest };
}
