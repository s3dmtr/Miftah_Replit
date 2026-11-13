import type { Listing, Property, State } from '../types';
import { isPublic } from './rules';

export interface Group { property: Property; listings: Listing[]; best: Listing }

/** One entry per underlying property, holding all its visible ads (cheapest first). */
export function publicGroups(s: State): Group[] {
  const map = new Map<string, Listing[]>();
  for (const l of s.listings) {
    if (!isPublic(s, l)) continue;
    const a = map.get(l.propertyId) ?? [];
    a.push(l);
    map.set(l.propertyId, a);
  }
  const out: Group[] = [];
  for (const [pid, ls] of map) {
    const property = s.properties.find((p) => p.id === pid)!;
    ls.sort((a, b) => a.price - b.price);
    out.push({ property, listings: ls, best: ls[0] });
  }
  return out;
}

export const advertiserOf = (s: State, id: string) => s.advertisers.find((a) => a.id === id)!;
