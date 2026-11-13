import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { baseState } from '../data/snapshot';
import type { L10n, Lang, State } from '../types';
import { DICT, type Key } from './i18n';
import { api, ApiError, remote, token } from './api';
import { createListing as localCreate, log, requestStatus as localRequest, reviewStatus as localReview, type CreateInput, type CreateResult } from './rules';

const KEY = 'miftah-app-v4';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.version === baseState().version) return s;
    }
  } catch { /* storage unavailable: use seed */ }
  return baseState();
}

/** Every data-changing action. Each goes to the Express API when VITE_API_URL is set, else runs locally. */
export interface Ops {
  switchUser(userId: string): Promise<void>;
  register(input: { name: string; phone: string; role: string; license?: string; crNumber?: string }): Promise<string>;
  createListing(advertiserId: string, input: CreateInput): Promise<CreateResult>;
  updateListing(id: string, patch: { price?: number; status?: 'active' | 'paused' }): Promise<void>;
  removeListing(id: string): Promise<void>;
  requestStatus(listingId: string, outcome: 'sold' | 'rented', value: number): Promise<void>;
  reviewStatus(requestId: string, approve: boolean): Promise<void>;
  verifyAdvertiser(advertiserId: string, approve: boolean): Promise<void>;
  resolveReport(reportId: string, pauseListing: boolean): Promise<void>;
  report(listingId: string, reason: string): Promise<void>;
  toggleFavorite(propertyId: string): Promise<void>;
  startConversation(listingId: string, advertiserId: string): Promise<string>;
  sendMessage(convId: string, text: string): Promise<void>;
  view(listingId: string): void;
  markNotificationsRead(): void;
}

interface Ctx {
  s: State;
  act: <T>(fn: (draft: State) => T) => T;
  ops: Ops;
  remote: boolean;
  error: string | null;
  reset: () => void;
  t: (k: Key) => string;
  L: (x: L10n) => string;
  lang: Lang;
  me: State['users'][number];
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(load);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(s);
  ref.current = s;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
    document.documentElement.lang = s.lang;
    document.documentElement.dir = s.lang === 'ar' ? 'rtl' : 'ltr';
  }, [s]);

  const act = useCallback(<T,>(fn: (draft: State) => T): T => {
    const draft = structuredClone(ref.current);
    const out = fn(draft);
    ref.current = draft;
    setS(draft);
    return out;
  }, []);

  /** Pull the server's view of the world into the same State shape the UI already renders. */
  const refresh = useCallback(async () => {
    const next = await api<State>('GET', '/state');
    const merged = { ...next, lang: ref.current.lang };
    ref.current = merged;
    setS(merged);
  }, []);

  useEffect(() => {
    if (!remote) return;
    (async () => {
      try {
        if (!token.get()) token.set((await api('POST', '/auth/demo-login', { userId: 'u-seeker' })).token);
        await refresh();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          token.set((await api('POST', '/auth/demo-login', { userId: 'u-seeker' })).token);
          await refresh();
        } else setError(`API unreachable: ${(e as Error).message}`);
      }
    })();
  }, [refresh]);

  const ops = useMemo<Ops>(() => {
    const me = () => ref.current.users.find((u) => u.id === ref.current.currentUserId)!;
    const run = async (fn: () => Promise<unknown>) => {
      try { await fn(); setError(null); } catch (e) { setError((e as Error).message); }
      await refresh().catch(() => {});
    };
    if (!remote) {
      return {
        switchUser: async (id) => { act((d) => { d.currentUserId = id; }); },
        register: async (inp) => act((d) => {
          const id = `u${Date.now().toString(36)}`;
          let advertiserId: string | undefined;
          if (inp.role !== 'seeker') {
            advertiserId = `a${Date.now().toString(36)}`;
            const licensed = inp.role === 'company' || inp.role === 'marketer';
            d.advertisers.push({ id: advertiserId, type: inp.role as 'owner', name: { ar: inp.name, en: inp.name }, license: licensed ? (inp.license ?? '').toUpperCase() : null, verified: inp.role === 'owner' ? 'verified' : 'pending', joined: new Date().toISOString().slice(0, 10) });
          }
          d.users.push({ id, name: { ar: inp.name, en: inp.name }, role: inp.role as 'seeker', advertiserId });
          d.currentUserId = id;
          return id;
        }),
        createListing: async (adv, inp) => act((d) => localCreate(d, adv, inp)),
        updateListing: async (id, patch) => act((d) => { const l = d.listings.find((x) => x.id === id)!; Object.assign(l, patch); }),
        removeListing: async (id) => act((d) => { const x = d.listings.find((y) => y.id === id)!; x.status = 'closed'; x.closedReason = undefined; }),
        requestStatus: async (id, outcome, value) => act((d) => localRequest(d, id, outcome, value)),
        reviewStatus: async (id, approve) => act((d) => localReview(d, id, approve, me().id)),
        verifyAdvertiser: async (id, approve) => act((d) => {
          d.advertisers.find((x) => x.id === id)!.verified = approve ? 'verified' : 'rejected';
          log(d, me().id, `${approve ? 'Verified' : 'Rejected'} advertiser ${id}`);
          if (approve) d.notices.unshift({ id: `n${Date.now()}`, to: id, text: { ar: 'تم توثيق حسابك، يمكنك نشر الإعلانات الآن.', en: 'Your account is verified. You can publish ads now.' }, at: new Date().toISOString(), read: false });
        }),
        resolveReport: async (id, pause) => act((d) => {
          const r = d.reports.find((x) => x.id === id)!;
          r.open = false;
          if (pause) d.listings.find((x) => x.id === r.listingId)!.status = 'paused';
          log(d, me().id, pause ? `Paused ad ${r.listingId} after report` : `Dismissed report ${r.id}`);
        }),
        report: async (listingId, reason) => act((d) => { d.reports.unshift({ id: `r${Date.now().toString(36)}`, listingId, by: me().id, reason, at: new Date().toISOString(), open: true }); }),
        toggleFavorite: async (pid) => act((d) => {
          const list = d.favorites[me().id] ?? [];
          d.favorites[me().id] = list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid];
        }),
        startConversation: async (listingId, advertiserId) => act((d) => {
          let c = d.conversations.find((x) => x.listingId === listingId && x.seekerId === me().id);
          if (!c) { c = { id: `cv${Date.now().toString(36)}`, listingId, seekerId: me().id, advertiserId, messages: [] }; d.conversations.unshift(c); }
          return c.id;
        }),
        sendMessage: async (convId, text) => act((d) => {
          const c = d.conversations.find((x) => x.id === convId)!;
          const u = me();
          const asAdvertiser = u.advertiserId === c.advertiserId && c.seekerId !== u.id;
          c.messages.push({ id: `m${Date.now().toString(36)}`, from: asAdvertiser ? c.advertiserId : u.id, text, at: new Date().toISOString() });
        }),
        view: (id) => act((d) => { const x = d.listings.find((y) => y.id === id); if (x) x.views += 1; }),
        markNotificationsRead: () => act((d) => { const u = me(); d.notices.forEach((n) => { if (n.to === u.id || n.to === u.advertiserId) n.read = true; }); }),
      };
    }
    return {
      switchUser: async (id) => run(async () => { token.set((await api('POST', '/auth/demo-login', { userId: id })).token); }),
      register: async (inp) => {
        // The prototype form has no email/password fields; the API requires them, so we derive demo credentials.
        const email = `${inp.phone || Date.now()}@users.miftah.demo`;
        const r = await api('POST', '/auth/register', { name: inp.name, email, password: `miftah-${inp.phone}-${Date.now()}`, phone: inp.phone, role: inp.role, license: inp.license || undefined, crNumber: inp.crNumber || undefined });
        token.set(r.token);
        await refresh();
        return r.user.id;
      },
      createListing: async (_adv, inp) => {
        try {
          const r = await api('POST', '/listings', {
            landCode: inp.landCode, type: inp.type, deal: inp.deal, price: inp.price, districtId: inp.landCode ? undefined : inp.districtId,
            area: inp.landCode ? undefined : inp.area, rooms: inp.rooms, baths: inp.baths, features: inp.features, descAr: inp.descAr, descEn: inp.descEn,
          });
          await refresh();
          return r as CreateResult;
        } catch (e) {
          await refresh().catch(() => {});
          if (e instanceof ApiError && ['duplicate', 'land_not_found', 'not_verified', 'property_closed'].includes(e.code)) {
            return { ok: false, error: e.code as 'duplicate', existingListingId: e.body.existingListingId };
          }
          return { ok: false, error: 'invalid' };
        }
      },
      updateListing: (id, patch) => run(() => api('PATCH', `/listings/${id}`, patch)),
      removeListing: (id) => run(() => api('DELETE', `/listings/${id}`)),
      requestStatus: (id, _o, value) => run(() => api('POST', `/listings/${id}/status-requests`, { value })),
      reviewStatus: (id, approve) => run(() => api('POST', `/admin/status-requests/${id}/${approve ? 'approve' : 'reject'}`)),
      verifyAdvertiser: (id, approve) => run(() => api('POST', `/admin/advertisers/${id}/verify`, { approve })),
      resolveReport: (id, pause) => run(() => api('POST', `/admin/reports/${id}/resolve`, { pauseListing: pause })),
      report: (listingId, reason) => run(() => api('POST', `/listings/${listingId}/reports`, { reason })),
      toggleFavorite: (pid) => run(() => {
        const on = (ref.current.favorites[me().id] ?? []).includes(pid);
        act((d) => { const l = d.favorites[me().id] ?? []; d.favorites[me().id] = on ? l.filter((x) => x !== pid) : [...l, pid]; });
        return api(on ? 'DELETE' : 'PUT', `/favorites/${pid}`);
      }),
      startConversation: async (listingId) => {
        const c = await api('POST', `/listings/${listingId}/inquiries`, {});
        await refresh();
        return c.id as string;
      },
      sendMessage: (convId, text) => run(() => api('POST', `/conversations/${convId}/messages`, { text })),
      view: (id) => { api('POST', `/listings/${id}/view`).catch(() => {}); },
      markNotificationsRead: () => {
        act((d) => { const u = me(); d.notices.forEach((n) => { if (n.to === u.id || n.to === u.advertiserId) n.read = true; }); });
        api('POST', '/notifications/read').catch(() => {});
      },
    };
  }, [act, refresh]);

  const value = useMemo<Ctx>(() => ({
    s,
    act,
    ops,
    remote,
    error,
    reset: () => (remote ? void refresh() : setS({ ...baseState(), lang: s.lang })),
    t: (k) => DICT[s.lang][k] ?? DICT.en[k] ?? k,
    L: (x) => x[s.lang],
    lang: s.lang,
    me: s.users.find((u) => u.id === s.currentUserId) ?? s.users[0],
  }), [s, act, ops, error, refresh]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}
