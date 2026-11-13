import { useEffect, useState } from 'react';

export function useRoute() {
  const get = () => (location.hash.replace(/^#/, '') || 'home');
  const [r, setR] = useState(get);
  useEffect(() => {
    const on = () => { setR(get()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
export const go = (name: string) => { location.hash = name; };
