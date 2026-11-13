// Offline starting data = a read-only export of the live PostgreSQL database (server/scripts/export-snapshot.ts).
// Falls back to the generated demo catalogue if no snapshot exists.
import type { State } from '../types';
import { initialState } from './seed';
import raw from './snapshot.json';

export const SNAPSHOT_AT: string | null = (raw as { exportedAt?: string }).exportedAt ?? null;
export function baseState(): State {
  const s = structuredClone(raw) as unknown as State & { exportedAt?: string };
  delete s.exportedAt;
  s.payments ??= [];
  return s.listings?.length ? s : initialState();
}
