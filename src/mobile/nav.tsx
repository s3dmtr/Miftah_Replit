import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Tab = 'home' | 'search' | 'ai' | 'messages' | 'profile' | 'dashboard' | 'reviews';
export type ScreenName = 'property' | 'compare' | 'chat' | 'add' | 'saved' | 'notifications' | 'search' | 'ai' | 'listing' | 'accounts' | 'messages' | 'pay' | 'receipt' | 'payments';
export interface Route { key: number; name: ScreenName; params: Record<string, any>; leaving?: boolean }

interface Nav {
  tab: Tab;
  stack: Route[];
  setTab: (t: Tab) => void;
  push: (name: ScreenName, params?: Record<string, any>) => void;
  pop: () => void;
  reset: () => void;
}
const Ctx = createContext<Nav | null>(null);
let seq = 1;

/** A tiny native-style navigator: one root tab plus a stack of pushed screens. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const pop = useCallback(() => {
    setStack((s) => {
      const top = [...s].reverse().find((r) => !r.leaving);
      if (!top) return s;
      window.setTimeout(() => setStack((x) => x.filter((r) => r.key !== top.key)), 260);
      return s.map((r) => (r.key === top.key ? { ...r, leaving: true } : r));
    });
  }, []);
  const value = useMemo<Nav>(() => ({
    tab, stack,
    setTab: (t) => { setStack([]); setTabState(t); },
    push: (name, params = {}) => setStack((s) => [...s.filter((r) => !r.leaving), { key: seq++, name, params }]),
    pop,
    reset: () => { setStack([]); setTabState('home'); },
  }), [tab, stack, pop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const c = useContext(Ctx);
  if (!c) throw new Error('NavProvider missing');
  return c;
}
