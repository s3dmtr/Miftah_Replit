import { POIS } from '../data/seed';
import type { Poi, PoiCat } from '../types';

export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest demo POI of a category (simulates a PostGIS ST_DWithin / KNN query). */
export function nearest(lat: number, lng: number, cat: PoiCat): { poi: Poi; km: number } | null {
  let best: { poi: Poi; km: number } | null = null;
  for (const p of POIS) {
    if (p.cat !== cat) continue;
    const d = km(lat, lng, p.lat, p.lng);
    if (!best || d < best.km) best = { poi: p, km: d };
  }
  return best;
}

export const POI_ORDER: PoiCat[] = ['masjid', 'school_middle', 'school_high', 'university', 'hospital', 'pharmacy', 'gym', 'park', 'mall'];
