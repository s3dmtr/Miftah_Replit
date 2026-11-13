import { Receipt, Bell, BadgeCheck, ChevronLeft, ChevronRight, Columns3, Globe, Heart, Info, LayoutDashboard, MessageCircle, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../lib/store';
import { publicGroups } from '../../lib/selectors';
import { dateFmt, num } from '../../components/ui';
import { AppHeader, Empty, PrimaryBtn, PropertyRow, SimTag, useToast, useTx } from '../kit';
import { useNav } from '../nav';
import { useMyConversations } from './Messages';

export const roleLabel = (r: string, tx: (a: string, e: string) => string) => ({
  seeker: tx('باحث عن عقار', 'Property seeker'), owner: tx('مالك عقار', 'Property owner'), company: tx('شركة عقارية', 'Real estate company'),
  marketer: tx('مسوّق مرخّص', 'Licensed marketer'), admin: tx('مدير المنصة', 'Administrator'), supervisor: tx('مشرف', 'Supervisor'),
} as Record<string, string>)[r];

export function ProfileScreen() {
  const { s, act, L, lang, me, reset, remote } = useStore();
  const nav = useNav();
  const tx = useTx();
  const toast = useToast();
  const adv = s.advertisers.find((a) => a.id === me.advertiserId);
  const saved = (s.favorites[me.id] ?? []).length;
  const convs = useMyConversations().length;
  const unread = s.notices.filter((n) => (n.to === me.id || n.to === me.advertiserId) && !n.read).length;
  const Chev = lang === 'ar' ? ChevronLeft : ChevronRight;
  const staff = me.role === 'admin' || me.role === 'supervisor';
  const Item = ({ icon, label, value, onClick }: { icon: ReactNode; label: string; value?: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="tap w-full flex items-center gap-3 px-4 py-3.5 text-start">
      <span className="grid place-items-center h-9 w-9 rounded-[12px] bg-band text-ink">{icon}</span>
      <span className="flex-1 font-semibold text-[14.5px]">{label}</span>
      {value !== undefined && <span className="text-[13px] text-muted num">{value}</span>}
      <Chev size={18} className="text-muted" />
    </button>
  );
  return (
    <div className="scroll">
      <section className="bg-[#172B45] text-[#F8F6F1] rounded-b-[32px] safe-top pb-6">
        <div className="pad pt-5 flex items-center gap-4">
          <span className="grid place-items-center h-16 w-16 rounded-[22px] bg-[#B69B72] text-[#172B45] text-[24px] font-bold">{L(me.name).slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="text-[19px] font-bold truncate flex items-center gap-1.5">{L(me.name)}{adv?.verified === 'verified' && <BadgeCheck size={18} className="text-[#9FE0BF]" />}</p>
            <p className="text-[13px] text-[#E8DDC9]/80">{roleLabel(me.role, tx)}</p>
            {adv?.license && <p className="text-[11.5px] text-[#E8DDC9]/60 num mt-0.5">{tx('رخصة فال', 'FAL')} {adv.license}</p>}
          </div>
        </div>
        <div className="pad mt-5 grid grid-cols-3 gap-2">
          {[[saved, tx('محفوظ', 'Saved')], [convs, tx('محادثة', 'Chats')], [unread, tx('إشعار جديد', 'New alerts')]].map(([n, k]) => (
            <div key={k as string} className="rounded-[16px] bg-white/[0.07] border border-white/10 py-3 text-center"><p className="text-[20px] font-bold num">{num(n as number, lang)}</p><p className="text-[11.5px] text-[#E8DDC9]/75">{k}</p></div>
          ))}
        </div>
      </section>

      <div className="pad py-5 grid gap-4 narrow">
        <div className="rounded-[20px] bg-surface border border-line divide-y divide-line overflow-hidden">
          {!staff && <Item icon={<Heart size={18} />} label={tx('العقارات المحفوظة', 'Saved properties')} value={num(saved, lang)} onClick={() => nav.push('saved')} />}
          {!staff && <Item icon={<Receipt size={18} />} label={adv ? tx('المدفوعات والحجوزات', 'Payments & bookings') : tx('مدفوعاتي', 'My payments')} value={num((s.payments ?? []).filter((x) => x.payerId === me.id || x.advertiserId === me.advertiserId).length, lang)} onClick={() => nav.push('payments')} />}
          <Item icon={<Bell size={18} />} label={tx('الإشعارات', 'Notifications')} value={unread ? num(unread, lang) : undefined} onClick={() => nav.push('notifications')} />
          {!staff && <Item icon={<MessageCircle size={18} />} label={tx('الرسائل', 'Messages')} value={num(convs, lang)} onClick={() => nav.setTab('messages')} />}
          {adv && <Item icon={<LayoutDashboard size={18} />} label={tx('لوحة المعلن', 'Advertiser dashboard')} onClick={() => nav.setTab('dashboard')} />}
          {staff && <Item icon={<ShieldCheck size={18} />} label={tx('المراجعات والتوثيق', 'Reviews & verification')} onClick={() => nav.setTab('reviews')} />}
        </div>
        <div className="rounded-[20px] bg-surface border border-line divide-y divide-line overflow-hidden">
          <Item icon={<Users size={18} />} label={tx('تبديل الحساب التجريبي', 'Switch demo account')} value={roleLabel(me.role, tx)} onClick={() => nav.push('accounts')} />
          <Item icon={<Globe size={18} />} label={tx('اللغة', 'Language')} value={lang === 'ar' ? 'العربية' : 'English'} onClick={() => act((d) => { d.lang = d.lang === 'ar' ? 'en' : 'ar'; })} />
          <Item icon={<RotateCcw size={18} />} label={tx('إعادة البيانات التجريبية', 'Reset demo data')} onClick={() => { reset(); nav.reset(); toast(tx('أُعيدت البيانات', 'Demo data restored')); }} />
        </div>
        <div className="rounded-[20px] border border-dashed border-line p-4 text-[12.5px] text-muted grid gap-2">
          <p className="font-bold text-ink flex items-center gap-1.5"><Info size={15} />{tx('عن هذا النموذج', 'About this prototype')}</p>
          <p>{remote ? tx('متصل بخادم مفتاح وقاعدة PostgreSQL.', 'Connected to the MIFTAH server and PostgreSQL.') : tx('يعمل على نسخة من قاعدة بيانات مفتاح؛ التغييرات تبقى على هذا الجهاز.', 'Runs on a copy of the MIFTAH database; changes stay on this device.')}</p>
          <div className="flex flex-wrap gap-1.5">
            <SimTag>{tx('كود الأرض: محاكاة', 'Land codes: simulated')}</SimTag><SimTag>{tx('رخص فال: محاكاة', 'FAL licences: simulated')}</SimTag>
            <SimTag>{tx('الخرائط والخدمات القريبة: تجريبية', 'Maps & nearby: demo')}</SimTag><SimTag>{tx('الدفع: تجريبي بلا خصم فعلي', 'Payments: test mode, nothing charged')}</SimTag>
            {!remote && <SimTag>{tx('ردود المعلنين: محاكاة', 'Advertiser replies: simulated')}</SimTag>}
          </div>
        </div>
        <p className="text-center text-[12px] text-muted pb-2">{tx('عقارك يبدأ بمفتاح', 'Your property starts with Miftah')}</p>
      </div>
    </div>
  );
}

const MAIN = ['u-seeker', 'u-owner', 'u-company', 'u-marketer', 'u-admin', 'u-super'];

export function AccountsScreen() {
  const { s, ops, L, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const toast = useToast();
  return (
    <div className="screen">
      <AppHeader title={tx('الحسابات التجريبية', 'Demo accounts')} sub={tx('بدّل الدور لتجربة كل جزء', 'Switch roles to try each part')} />
      <div className="scroll pad py-4 grid gap-2 content-start narrow">
        {[...s.users].sort((a, b) => +!MAIN.includes(a.id) - +!MAIN.includes(b.id)).map((u) => (
          <button key={u.id} type="button" onClick={async () => { await ops.switchUser(u.id); nav.reset(); toast(tx(`تم الدخول كـ ${L(u.name)}`, `Signed in as ${L(u.name)}`)); }}
            className={`tap flex items-center gap-3 rounded-[18px] p-3 border text-start ${me.id === u.id ? 'bg-gold/10 border-gold' : 'bg-surface border-line'}`}>
            <span className="grid place-items-center h-11 w-11 rounded-full bg-band font-bold">{L(u.name).slice(0, 1)}</span>
            <span className="min-w-0 flex-1"><span className="block font-bold truncate">{L(u.name)}</span><span className="block text-[12px] text-muted">{roleLabel(u.role, tx)}</span></span>
            {me.id === u.id && <span className="text-[12px] font-bold text-goldink">{tx('الحالي', 'Current')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SavedScreen() {
  const { s, me, lang } = useStore();
  const nav = useNav();
  const tx = useTx();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const ids = s.favorites[me.id] ?? [];
  const groups = publicGroups(s).filter((g) => ids.includes(g.property.id));
  const toggle = (id: string) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < 3 ? [...x, id] : x));
  return (
    <div className="screen">
      <AppHeader title={tx('المحفوظات', 'Saved')} sub={tx(`${num(groups.length, lang)} عقار`, `${groups.length} properties`)}
        actions={groups.length > 1 ? <button type="button" onClick={() => { setPicking(!picking); setPicked([]); }} className="tap h-9 px-3 rounded-full text-[13px] font-bold text-goldink">{picking ? tx('إلغاء', 'Cancel') : tx('قارن', 'Compare')}</button> : undefined} />
      <div className="scroll pad py-4 grid gap-3 content-start pb-28 list-grid">
        {picking && <p className="text-[12.5px] text-muted col-span-full">{tx('اختر عقارين أو ثلاثة للمقارنة', 'Pick 2 or 3 properties to compare')}</p>}
        {groups.length === 0 ? <Empty icon={<Heart size={26} />} title={tx('لا توجد عقارات محفوظة', 'Nothing saved yet')} sub={tx('اضغط على القلب في أي عقار لحفظه هنا.', 'Tap the heart on any property to save it.')} />
          : groups.map((g) => picking ? (
            <button key={g.property.id} type="button" onClick={() => toggle(g.property.id)} className={`tap rounded-[22px] border-2 text-start ${picked.includes(g.property.id) ? 'border-gold' : 'border-transparent'}`}>
              <div className="pointer-events-none"><PropertyRow g={g} /></div>
            </button>
          ) : <PropertyRow key={g.property.id} g={g} />)}
      </div>
      {picking && (
        <div className="absolute bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line safe-bottom">
          <div className="pad py-3 narrow"><PrimaryBtn className="w-full" disabled={picked.length < 2} onClick={() => nav.push('compare', { ids: picked })}><Columns3 size={18} />{tx(`قارن (${num(picked.length, lang)})`, `Compare (${picked.length})`)}</PrimaryBtn></div>
        </div>
      )}
    </div>
  );
}

export function NotificationsScreen() {
  const { s, ops, L, lang, me } = useStore();
  const tx = useTx();
  const list = s.notices.filter((n) => n.to === me.id || n.to === me.advertiserId);
  const [unreadIds] = useState(() => new Set(list.filter((n) => !n.read).map((n) => n.id)));
  useEffect(() => { ops.markNotificationsRead(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="screen">
      <AppHeader title={tx('الإشعارات', 'Notifications')} />
      <div className="scroll">
        {list.length === 0 ? <Empty icon={<Bell size={26} />} title={tx('لا توجد إشعارات', 'No notifications')} /> : list.map((n) => (
          <div key={n.id} className={`pad py-3.5 border-b border-line/70 flex gap-3 ${unreadIds.has(n.id) ? 'bg-gold/[0.07]' : ''}`}>
            <span className="grid place-items-center h-9 w-9 rounded-full bg-band shrink-0"><Bell size={16} /></span>
            <div className="min-w-0"><p className="text-[14px]">{L(n.text)}</p><p className="text-[11.5px] text-muted mt-0.5">{dateFmt(n.at, lang)}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
