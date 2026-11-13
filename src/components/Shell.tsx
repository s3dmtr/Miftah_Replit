import { Bell, Building2, Heart, Home, KeyRound, LayoutDashboard, MessageCircle, Search, ShieldCheck, Sparkles, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import type { Role } from '../types';
import { dateFmt } from './ui';

export function Logo({ light = true }: { light?: boolean }) {
  const { lang } = useStore();
  return (
    <a href="#home" className="press flex items-center gap-2 shrink-0" aria-label="MIFTAH">
      <span className="grid place-items-center h-9 w-9 rounded-[10px] bg-gold/20 border border-gold/50">
        <KeyRound size={18} className="text-gold" strokeWidth={2.2} />
      </span>
      <span className={`leading-none ${light ? 'text-[#F8F6F1]' : 'text-ink'}`}>
        <span className="block text-[17px] font-bold tracking-tight">{lang === 'ar' ? 'مفتاح' : 'MIFTAH'}</span>
        <span className="block text-[10.5px] tracking-[0.18em] uppercase text-gold mt-0.5">{lang === 'ar' ? 'MIFTAH' : 'مفتاح'}</span>
      </span>
    </a>
  );
}

const isAdvertiser = (r: Role) => r === 'owner' || r === 'company' || r === 'marketer';
const isStaff = (r: Role) => r === 'admin' || r === 'supervisor';

export function Shell({ route, children }: { route: string; children: ReactNode }) {
  const { s, act, ops, t, L, lang, me, reset, error } = useStore();
  const [bell, setBell] = useState(false);
  const myKeys = [me.id, me.advertiserId].filter(Boolean) as string[];
  const notes = s.notices.filter((n) => myKeys.includes(n.to));
  const unread = notes.filter((n) => !n.read).length;
  const unreadMsgs = s.conversations.filter((c) => (c.seekerId === me.id || c.advertiserId === me.advertiserId) && c.messages.length && c.messages[c.messages.length - 1].from !== me.id && c.messages[c.messages.length - 1].from !== me.advertiserId).length;

  const nav: { id: string; label: string; icon: ReactNode; show: boolean; badge?: number }[] = [
    { id: 'home', label: t('nav_home'), icon: <Home size={18} />, show: true },
    { id: 'search', label: t('nav_search'), icon: <Search size={18} />, show: true },
    { id: 'agent', label: t('nav_agent'), icon: <Sparkles size={18} />, show: true },
    { id: 'favorites', label: t('nav_favorites'), icon: <Heart size={18} />, show: !isStaff(me.role) },
    { id: 'messages', label: t('nav_messages'), icon: <MessageCircle size={18} />, show: !isStaff(me.role), badge: unreadMsgs },
    { id: 'dashboard', label: t('nav_dashboard'), icon: <LayoutDashboard size={18} />, show: isAdvertiser(me.role) },
    { id: 'admin', label: t('nav_admin'), icon: <ShieldCheck size={18} />, show: isStaff(me.role) },
  ];
  const active = (id: string) => route === id || (id === 'search' && route.startsWith('property-')) || (id === 'messages' && route.startsWith('chat-'));
  const shown = nav.filter((n) => n.show);
  const mobile = shown.filter((n) => n.id !== 'favorites' || !isAdvertiser(me.role)).slice(0, 5);

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky z-40 bg-[#172B45] text-[#F8F6F1] shadow-[0_1px_0_rgba(182,155,114,.35)]" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto max-w-[1200px] h-16 flex items-center gap-4">
          <Logo />
          <nav className="hidden lg:flex items-center gap-1 ms-4">
            {shown.map((n) => (
              <a key={n.id} href={`#${n.id}`}
                className={`press relative flex items-center gap-1.5 rounded-ctl px-3 h-9 text-sm font-semibold ${active(n.id) ? 'bg-white/10 text-white' : 'text-[#E8DDC9]/85 hover:text-white'}`}>
                {n.icon}{n.label}
                {!!n.badge && <span className="ms-1 grid place-items-center h-4 min-w-4 px-1 rounded-full bg-[#B69B72] text-[10px] text-[#172B45]">{n.badge}</span>}
                {active(n.id) && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#B69B72] rounded-full" />}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <label className="hidden sm:flex items-center gap-2 text-xs text-[#E8DDC9]/80">
              <span>{t('viewing_as')}</span>
              <select id="role-switch" value={me.id} onChange={(e) => { void ops.switchUser(e.target.value); }}
                className="h-9 rounded-ctl bg-white/10 border border-white/15 text-[#F8F6F1] text-[13px] px-2 max-w-[190px]">
                {s.users.map((u) => <option key={u.id} value={u.id} className="text-[#172B45]">{t(`role_${u.role}` as never)} · {L(u.name)}</option>)}
              </select>
            </label>
            <div className="relative">
              <button type="button" aria-label={t('notifications')} onClick={() => { setBell(!bell); ops.markNotificationsRead(); }}
                className="press relative grid place-items-center h-9 w-9 rounded-ctl hover:bg-white/10">
                <Bell size={18} />
                {!!unread && <span className="absolute top-1 end-1 h-2.5 w-2.5 rounded-full bg-[#B69B72] ring-2 ring-[#172B45]" />}
              </button>
              {bell && (
                <div className="absolute end-0 mt-2 w-[min(340px,calc(100vw-32px))] rounded-card border border-line bg-surface text-ink shadow-card p-2 rise">
                  <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted">{t('notifications')}</p>
                  {notes.length === 0 && <p className="px-2 py-4 text-sm text-muted">{t('no_notifications')}</p>}
                  <div className="max-h-80 overflow-y-auto">
                    {notes.slice(0, 12).map((n) => (
                      <div key={n.id} className="px-2 py-2 border-t border-line text-sm">
                        <p>{L(n.text)}</p>
                        <p className="text-xs text-muted mt-0.5">{dateFmt(n.at, lang)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => act((d) => { d.lang = d.lang === 'ar' ? 'en' : 'ar'; })}
              className="press h-9 px-3 rounded-ctl border border-[#B69B72]/60 text-[13px] font-bold text-[#E8DDC9] hover:bg-white/10">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </div>
        <div className="sm:hidden gutter pb-2 -mt-1">
          <select id="role-switch-m" value={me.id} onChange={(e) => { void ops.switchUser(e.target.value); }}
            className="w-full h-9 rounded-ctl bg-white/10 border border-white/15 text-[#F8F6F1] text-[13px] px-2">
            {s.users.map((u) => <option key={u.id} value={u.id} className="text-[#172B45]">{t('viewing_as')} {t(`role_${u.role}` as never)} · {L(u.name)}</option>)}
          </select>
        </div>
      </header>

      <div className="bg-band/70 border-b border-line">
        <div className="gutter mx-auto max-w-[1200px] py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink">
          <span className="inline-flex items-center gap-1.5 font-semibold"><Building2 size={14} className="text-goldink" />{t('demo_strip')}</span>
          {error && <span className="text-bad font-semibold">{error}</span>}
          <button type="button" onClick={reset} className="press ms-auto inline-flex items-center gap-1 text-goldink font-semibold hover:underline">
            <RotateCcw size={13} />{t('reset_demo')}
          </button>
        </div>
      </div>

      <main className="flex-1 pb-24 lg:pb-12">{children}</main>

      <footer className="hidden lg:block border-t border-line">
        <div className="gutter mx-auto max-w-[1200px] py-6 flex items-center justify-between text-sm text-muted">
          <span>{t('slogan')} · {lang === 'ar' ? 'الرياض' : 'Riyadh'}</span>
          <span>{t('footer_note')}</span>
        </div>
      </footer>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0,1fr))` }}>
          {mobile.map((n) => (
            <button key={n.id} type="button" onClick={() => go(n.id)}
              className={`press relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active(n.id) ? 'text-ink' : 'text-muted'}`}>
              {active(n.id) && <span className="absolute top-0 h-[2px] w-8 bg-gold rounded-full" />}
              {n.icon}
              <span className="truncate max-w-full px-1">{n.label}</span>
              {!!n.badge && <span className="absolute top-1.5 start-[calc(50%+6px)] h-2 w-2 rounded-full bg-gold" />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
