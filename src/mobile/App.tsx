import { Home, KeyRound, LayoutDashboard, MessageCircle, Search, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { useMyConversations } from './screens/Messages';
import { NavProvider, useNav, type Route, type Tab } from './nav';
import { ToastProvider, useTx } from './kit';
import { HomeScreen } from './screens/Home';
import { SearchScreen } from './screens/Search';
import { AgentScreen } from './screens/Agent';
import { PropertyScreen } from './screens/Property';
import { CompareScreen } from './screens/Compare';
import { ChatScreen, InboxScreen } from './screens/Messages';
import { AccountsScreen, NotificationsScreen, ProfileScreen, SavedScreen } from './screens/Profile';
import { DashboardScreen } from './screens/Dashboard';
import { AddListingScreen } from './screens/AddListing';
import { ReviewsScreen } from './screens/Reviews';
import { PaymentScreen, PaymentsScreen, ReceiptScreen } from './screens/Payment';
import './mobile.css';

function Splash({ onDone }: { onDone: () => void }) {
  const { lang } = useStore();
  const [out, setOut] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => setOut(true), 2100);
    const b = window.setTimeout(onDone, 2450);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [onDone]);
  return (
    <button type="button" aria-label="MIFTAH" onClick={onDone}
      className={`absolute inset-0 z-[70] bg-[#172B45] text-[#F8F6F1] grid place-items-center ${out ? 'splash-out' : ''}`}>
      <svg className="absolute inset-0 h-full w-full opacity-[.06]" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => <path key={i} d={`M${-50 + i * 60} 820 L${150 + i * 60} 300 L${350 + i * 60} 820`} fill="none" stroke="#B69B72" strokeWidth="1.2" />)}
      </svg>
      <div className="grid justify-items-center gap-5">
        <span className="key-turn grid place-items-center h-24 w-24 rounded-[30px] bg-[#B69B72]/18 border border-[#B69B72]/60 shadow-[0_0_60px_rgba(182,155,114,.25)]">
          <KeyRound size={46} className="text-[#B69B72]" strokeWidth={1.8} />
        </span>
        <div className="text-center rise-1">
          <p className="text-[44px] font-bold leading-none">مفتاح</p>
          <p className="text-[13px] tracking-[0.5em] text-[#B69B72] mt-2 ms-[0.5em]">MIFTAH</p>
        </div>
        <p className="rise-2 text-[15px] text-[#E8DDC9]/85">{lang === 'ar' ? 'عقارك يبدأ بمفتاح' : 'Your property starts with Miftah'}</p>
      </div>
      <div className="absolute bottom-16 inset-x-0 grid justify-items-center gap-3 rise-2">
        <span className="h-1 w-24 rounded-full bg-white/10 overflow-hidden"><span className="splash-bar block h-full bg-[#B69B72]" style={{ ['--start' as string]: lang === 'ar' ? 'right' : 'left' }} /></span>
        <span className="text-[11px] text-[#E8DDC9]/50">{lang === 'ar' ? 'الرياض · المملكة العربية السعودية' : 'Riyadh · Saudi Arabia'}</span>
      </div>
    </button>
  );
}

function tabsFor(role: string): Tab[] {
  if (role === 'owner' || role === 'company' || role === 'marketer') return ['home', 'dashboard', 'ai', 'messages', 'profile'];
  if (role === 'admin' || role === 'supervisor') return ['home', 'search', 'ai', 'reviews', 'profile'];
  return ['home', 'search', 'ai', 'messages', 'profile'];
}

function BottomNav() {
  const { me, s } = useStore();
  const nav = useNav();
  const tx = useTx();
  const convs = useMyConversations();
  const unreadMsgs = convs.filter((c) => { const m = c.messages.at(-1); return m && m.from !== me.id && m.from !== me.advertiserId; }).length;
  const pending = s.statusRequests.filter((r) => r.state === 'pending').length;
  const meta: Record<Tab, [ReactNode, string, number?]> = {
    home: [<Home size={22} key="h" />, tx('الرئيسية', 'Home')],
    search: [<Search size={22} key="s" />, tx('البحث', 'Search')],
    ai: [<Sparkles size={24} key="a" />, tx('مفتاح AI', 'Miftah AI')],
    messages: [<MessageCircle size={22} key="m" />, tx('الرسائل', 'Messages'), unreadMsgs],
    profile: [<User size={22} key="p" />, tx('حسابي', 'Profile')],
    dashboard: [<LayoutDashboard size={22} key="d" />, tx('لوحتي', 'Dashboard')],
    reviews: [<ShieldCheck size={22} key="r" />, tx('المراجعات', 'Reviews'), pending],
  };
  return (
    <nav className="absolute bottom-0 inset-x-0 z-30 bg-surface/96 backdrop-blur border-t border-line safe-bottom" aria-label={tx('التنقل الرئيسي', 'Main navigation')}>
      <div className="nav-inner grid grid-cols-5 h-[66px] items-center">
        {tabsFor(me.role).map((t) => {
          const [icon, label, badge] = meta[t];
          const on = nav.tab === t;
          if (t === 'ai') {
            return (
              <button key={t} type="button" onClick={() => nav.setTab(t)} aria-label={label} aria-current={on ? 'page' : undefined} className="tap grid justify-items-center -mt-7">
                <span className={`grid place-items-center h-[58px] w-[58px] rounded-[20px] shadow-[0_10px_24px_rgba(23,43,69,.35)] border-4 border-bg ${on ? 'bg-[#B69B72] text-[#172B45]' : 'bg-[#172B45] text-[#B69B72]'}`}>{icon}</span>
                <span className={`text-[10.5px] font-bold mt-0.5 ${on ? 'text-ink' : 'text-muted'}`}>{label}</span>
              </button>
            );
          }
          return (
            <button key={t} type="button" onClick={() => nav.setTab(t)} aria-current={on ? 'page' : undefined} className={`tap relative grid justify-items-center gap-1 ${on ? 'text-ink' : 'text-muted'}`}>
              {on && <span className="absolute -top-[9px] h-[3px] w-7 rounded-full bg-gold" />}
              {icon}
              <span className={`text-[10.5px] ${on ? 'font-bold' : 'font-semibold'}`}>{label}</span>
              {!!badge && <span className="absolute top-0 start-[calc(50%+6px)] h-4 min-w-4 px-1 rounded-full bg-gold text-[#172B45] text-[10px] font-bold grid place-items-center">{badge}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function renderTab(t: Tab) {
  switch (t) {
    case 'home': return <div className="screen"><HomeScreen /></div>;
    case 'search': return <SearchScreen root />;
    case 'ai': return <AgentScreen />;
    case 'messages': return <InboxScreen />;
    case 'profile': return <div className="screen"><ProfileScreen /></div>;
    case 'dashboard': return <div className="screen"><DashboardScreen /></div>;
    case 'reviews': return <ReviewsScreen />;
  }
}

function renderRoute(r: Route) {
  const p = r.params;
  switch (r.name) {
    case 'property': return <PropertyScreen id={p.id} offer={p.offer} />;
    case 'compare': return <CompareScreen pid={p.pid} ids={p.ids} />;
    case 'chat': return <ChatScreen id={p.id} />;
    case 'add': return <AddListingScreen />;
    case 'saved': return <SavedScreen />;
    case 'notifications': return <NotificationsScreen />;
    case 'search': return <SearchScreen filters={p.filters} />;
    case 'accounts': return <AccountsScreen />;
    case 'messages': return <InboxScreen root={false} />;
    case 'pay': return <PaymentScreen listingId={p.listingId} />;
    case 'receipt': return <ReceiptScreen id={p.id} fresh={p.fresh} />;
    case 'payments': return <PaymentsScreen />;
    default: return null;
  }
}

function Screens() {
  const { me } = useStore();
  const nav = useNav();
  const tabs = tabsFor(me.role);
  // A role switch may remove the current tab (e.g. Dashboard for a seeker).
  useEffect(() => { if (!tabs.includes(nav.tab)) nav.setTab('home'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [me.role]);
  const live = nav.stack.filter((r) => !r.leaving);
  return (
    <>
      <div className={`absolute inset-0 below ${live.length ? 'covered' : ''}`} style={{ bottom: 0 }}>
        <div key={nav.tab} className="absolute inset-0 tab-in" style={{ paddingBottom: 'calc(66px + var(--sab, env(safe-area-inset-bottom, 0px)))' }}>
          <div className="relative h-full">{renderTab(nav.tab)}</div>
        </div>
        <BottomNav />
      </div>
      {nav.stack.map((r, i) => {
        const coveredBy = nav.stack.slice(i + 1).some((x) => !x.leaving);
        return (
          <div key={r.key} className={`absolute inset-0 z-40 ${r.leaving ? 'push-out' : 'push-in'}`}>
            <div className={`absolute inset-0 below ${coveredBy ? 'covered' : ''}`}>{renderRoute(r)}</div>
          </div>
        );
      })}
    </>
  );
}

type Device = 'iphone' | 'ipad';
const DEVICES = {
  // Logical (point) sizes. iPhone 17: 402×874, 6.3". iPad Pro 12.9": 1024×1366.
  iphone: { w: 402, h: 874, pad: 13, sat: 54, sab: 30, label: 'iPhone 17' },
  ipad: { w: 1024, h: 1366, pad: 26, sat: 26, sab: 22, label: 'iPad Pro 12.9″' },
};
const PREF = 'miftah-stage';
const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF) ?? '{}'); } catch { return {}; } };

function StatusBar({ device }: { device: Device }) {
  const ipad = device === 'ipad';
  return (
    <div className="statusbar" style={{ height: ipad ? 26 : 54, padding: ipad ? '0 22px' : '0 34px 0 44px', fontSize: ipad ? 13 : 16 }}>
      <span>{ipad ? '9:41  Fri 13 Nov' : '9:41'}</span>
      <span className="sb-icons" aria-hidden="true">
        <svg width={ipad ? 16 : 18} height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4.2-4.3L2.4 5.8a7.9 7.9 0 0 1 11.2 0l-1.4 1.4a5.9 5.9 0 0 0-8.4 0ZM.9 4.3-.5 2.9a12 12 0 0 1 17 0l-1.4 1.4a10 10 0 0 0-14.2 0Z" fill="currentColor" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor" /><rect x="24.5" y="4.5" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

export function MobileApp() {
  const { lang } = useStore();
  const ar = lang === 'ar';
  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);
  const [device, setDevice] = useState<Device>(() => (readPref().device === 'ipad' ? 'ipad' : 'iphone'));
  const [landscape, setLandscape] = useState<boolean>(() => !!readPref().landscape);
  useEffect(() => { try { localStorage.setItem(PREF, JSON.stringify({ device, landscape })); } catch { /* ignore */ } }, [device, landscape]);

  // Real phones/tablets (touch, or narrow windows) get the app full-screen with no frame.
  const bareQuery = '(max-width: 600px), (pointer: coarse)';
  const [bare, setBare] = useState(() => window.matchMedia(bareQuery).matches);
  const [vw, setVw] = useState(window.innerWidth);
  useEffect(() => {
    const mq = window.matchMedia(bareQuery);
    const on = () => { setBare(mq.matches); setVw(window.innerWidth); };
    mq.addEventListener('change', on); window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);

  // Fit the true-size device into the available area.
  // Measure the whole body; the guide (330px + 48px gap) is subtracted when it is shown.
  const fitRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 700 });
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width - (window.innerWidth > 1100 ? 378 : 0), h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bare]);

  const d = DEVICES[device];
  const rot = device === 'ipad' && landscape;
  const sw = rot ? d.h : d.w, sh = rot ? d.w : d.h;           // screen size in points
  const fw = sw + d.pad * 2, fh = sh + d.pad * 2;            // frame size
  const scale = Math.min(1, box.w / fw, box.h / fh);
  const tablet = bare ? vw >= 700 : device === 'ipad';
  const wide = bare ? vw >= 1100 : rot;

  const app = (
    <ToastProvider>
      <NavProvider>
        <div className={`app ${tablet ? 'tablet' : ''} ${wide ? 'wide' : ''}`}><Screens /></div>
        {splash && <Splash onDone={endSplash} />}
      </NavProvider>
    </ToastProvider>
  );

  if (bare) return <div className="stage bare"><div className="device-screen">{app}</div></div>;

  return (
    <div className="stage">
      <div className="stage-bar" dir={ar ? 'rtl' : 'ltr'}>
        <div className="stage-seg" role="group" aria-label={ar ? 'الجهاز' : 'Device'}>
          <button type="button" aria-pressed={device === 'iphone'} onClick={() => setDevice('iphone')}>
            <svg width="11" height="17" viewBox="0 0 11 17" aria-hidden="true"><rect x=".75" y=".75" width="9.5" height="15.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="3.5" y="2.5" width="4" height="1.3" rx=".65" fill="currentColor" /></svg>iPhone 17
          </button>
          <button type="button" aria-pressed={device === 'ipad'} onClick={() => setDevice('ipad')}>
            <svg width="15" height="18" viewBox="0 0 15 18" aria-hidden="true"><rect x=".75" y=".75" width="13.5" height="16.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>iPad Pro 12.9″
          </button>
        </div>
        {device === 'ipad' && (
          <div className="stage-seg" role="group" aria-label={ar ? 'الاتجاه' : 'Orientation'}>
            <button type="button" aria-pressed={!landscape} onClick={() => setLandscape(false)}>{ar ? 'عمودي' : 'Portrait'}</button>
            <button type="button" aria-pressed={landscape} onClick={() => setLandscape(true)}>{ar ? 'أفقي' : 'Landscape'}</button>
          </div>
        )}
        <span className="text-[12px] text-[#E8DDC9]/55 num">{sw}×{sh} pt · {Math.round(scale * 100)}%</span>
      </div>
      <div className="stage-body" dir={ar ? 'rtl' : 'ltr'} ref={fitRef}>
        <aside className="guide">
          <p className="flex items-center gap-2 text-[#B69B72] font-bold tracking-wide"><KeyRound size={18} />{ar ? 'مفتاح · نموذج التطبيق' : 'MIFTAH · app prototype'}</p>
          <h1 className="text-[32px] font-bold text-[#F8F6F1] leading-tight mt-3">{ar ? 'عقارك يبدأ بمفتاح' : 'Your property starts with Miftah'}</h1>
          <p className="text-[14px] text-[#E8DDC9]/75 mt-3 leading-relaxed">{ar ? 'نموذج تفاعلي كامل. جرّب البحث بالعربية مع مساعد مفتاح، وقارن عروض المعلنين لنفس العقار، وراسل المعلن، ثم بدّل الحساب من «حسابي» لتجربة لوحة المعلن والمراجعة.' : 'A fully interactive prototype. Search in Arabic with the Miftah agent, compare advertisers’ offers on one property, message an advertiser, then switch accounts in Profile to try the advertiser and reviewer flows.'}</p>
          <ul className="mt-5 grid gap-2 text-[13px] text-[#E8DDC9]/80">
            {(ar ? ['البيانات: نسخة من قاعدة PostgreSQL الخاصة بمفتاح', 'كود الأرض ورخص فال: محاكاة', 'الخرائط والخدمات القريبة: بيانات تجريبية', 'مساعد الذكاء: محادثة عربية/إنجليزية (بدون OpenAI)', 'الدفع والإيصالات: تجريبي، لا خصم فعلي', 'ردود المعلن في العرض: مولّدة من بيانات الإعلان']
              : ['Data: a copy of MIFTAH’s PostgreSQL database', 'Land codes and FAL licences: simulated', 'Maps and nearby places: demo data', 'AI agent: Arabic/English conversation (no OpenAI)', 'Payments & receipts: test mode, nothing charged', 'Advertiser replies in the demo: generated from ad data']).map((x) => (
              <li key={x} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#B69B72] shrink-0" />{x}</li>
            ))}
          </ul>
        </aside>
        <div className="stage-fit">
          <div className="device-scaler" style={{ width: fw * scale, height: fh * scale }}>
            <div className={`device ${device}`} style={{ width: fw, height: fh, transform: `scale(${scale})` }} dir="ltr">
              {device === 'iphone' ? <>
                <span className="hw-btn" style={{ left: -3, top: 190, width: 4, height: 34 }} />
                <span className="hw-btn" style={{ left: -3, top: 250, width: 4, height: 64 }} />
                <span className="hw-btn" style={{ left: -3, top: 326, width: 4, height: 64 }} />
                <span className="hw-btn" style={{ right: -3, top: 280, width: 4, height: 100 }} />
              </> : <span className="ipad-cam" style={rot ? { left: 9, top: '50%', marginTop: -4 } : { top: 9, left: '50%', marginLeft: -4 }} />}
              <div className="device-screen" dir={ar ? 'rtl' : 'ltr'} style={{ ['--sat' as string]: `${d.sat}px`, ['--sab' as string]: `${d.sab}px` }}>
                {app}
                {device === 'iphone' && <span className="island" />}
                <StatusBar device={device} />
                <span className="home-ind" style={{ width: device === 'iphone' ? 140 : 320 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
