import { EyeOff, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import { hasBad, moderate } from '../../lib/moderation';
import { PropertyArt } from '../../components/PropertyArt';
import { money } from '../../components/ui';
import type { Conversation } from '../../types';
import { AppHeader, Empty, SimTag, useTx } from '../kit';
import { useNav } from '../nav';

const time = (iso: string, lang: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const day = (iso: string, lang: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));

export function useMyConversations() {
  const { s, me } = useStore();
  return s.conversations.filter((c) => c.seekerId === me.id || (me.advertiserId && c.advertiserId === me.advertiserId))
    .sort((a, b) => (b.messages.at(-1)?.at ?? '').localeCompare(a.messages.at(-1)?.at ?? ''));
}

export function InboxScreen({ root = true }: { root?: boolean }) {
  const { s, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const convs = useMyConversations();
  const other = (c: Conversation) => c.seekerId === me.id ? L(s.advertisers.find((a) => a.id === c.advertiserId)!.name)
    : L(s.users.find((u) => u.id === c.seekerId)?.name ?? { ar: 'باحث عن عقار', en: 'Property seeker' });
  return (
    <div className="screen">
      <AppHeader back={!root} title={tx('الرسائل', 'Messages')} sub={tx('محادثاتك مع المعلنين والباحثين', 'Your conversations')} />
      <div className="scroll narrow">
        {convs.length === 0 ? (
          <Empty icon={<MessageCircle size={26} />} title={tx('لا توجد محادثات بعد', 'No conversations yet')} sub={tx('افتح أي عقار واضغط «راسل المعلن».', 'Open a property and tap “Message advertiser”.')} />
        ) : convs.map((c) => {
          const l = s.listings.find((x) => x.id === c.listingId)!;
          const p = s.properties.find((x) => x.id === l.propertyId)!;
          const last = c.messages.at(-1);
          const incoming = last && last.from !== me.id && last.from !== me.advertiserId;
          return (
            <button key={c.id} type="button" onClick={() => nav.push('chat', { id: c.id })} className="tap w-full flex items-center gap-3 pad py-3 border-b border-line/70 text-start">
              <div className="relative shrink-0">
                <span className="grid place-items-center h-12 w-12 rounded-full bg-band font-bold text-[17px]">{other(c).slice(0, 1)}</span>
                <PropertyArt type={p.type} seed={l.imageSeed} className="absolute -bottom-1 -end-1 h-6 w-6 rounded-full border-2 border-bg" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><p className="font-bold text-[14.5px] truncate">{other(c)}</p>{last && <span className="text-[11px] text-muted shrink-0">{day(last.at, lang)}</span>}</div>
                <p className="text-[12px] text-goldink truncate">{L(l.title)}</p>
                <p className={`text-[13px] truncate ${incoming ? 'text-ink font-semibold' : 'text-muted'}`}>{last ? last.text : tx('ابدأ المحادثة', 'Start the conversation')}</p>
              </div>
              {incoming && <span className="h-2.5 w-2.5 rounded-full bg-gold shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AUTO = [
  { ar: 'شكراً لتواصلك، العرض ما زال متاحاً. متى يناسبك موعد المعاينة؟', en: 'Thanks for reaching out, the offer is still available. When suits you for a viewing?' },
  { ar: 'تمام، سأرسل لك التفاصيل والموقع قريباً.', en: 'Great, I will send you the details and location shortly.' },
];

export function ChatScreen({ id }: { id: string }) {
  const { s, act, ops, remote, L, lang, me } = useStore();
  const nav = useNav();
  const tx = useTx();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const c = s.conversations.find((x) => x.id === id);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [c?.messages.length]);
  if (!c) return <div className="screen"><AppHeader title={tx('المحادثة', 'Chat')} /><Empty icon={<MessageCircle size={26} />} title={tx('المحادثة غير موجودة', 'Conversation not found')} /></div>;
  const l = s.listings.find((x) => x.id === c.listingId)!;
  const p = s.properties.find((x) => x.id === l.propertyId)!;
  const asAdvertiser = me.advertiserId === c.advertiserId && c.seekerId !== me.id;
  const otherName = asAdvertiser ? L(s.users.find((u) => u.id === c.seekerId)?.name ?? { ar: 'باحث', en: 'Seeker' }) : L(s.advertisers.find((a) => a.id === c.advertiserId)!.name);
  const mine = (from: string) => from === me.id || from === me.advertiserId;

  const send = () => {
    const v = text.trim();
    if (!v) return;
    void ops.sendMessage(c.id, v);
    setText('');
    if (!remote && !asAdvertiser) {
      // Offline demo only: a simulated advertiser reply. With the API, replies come from the real advertiser account.
      window.setTimeout(() => act((d) => {
        const cv = d.conversations.find((x) => x.id === c.id)!;
        cv.messages.push({ id: `auto${Date.now().toString(36)}`, from: cv.advertiserId, text: AUTO[cv.messages.length % 2][lang], at: new Date().toISOString() });
      }), 1500);
    }
  };

  return (
    <div className="screen">
      <AppHeader title={otherName} sub={asAdvertiser ? tx('باحث عن عقار', 'Property seeker') : tx('معلن موثّق', 'Verified advertiser')} />
      <button type="button" onClick={() => nav.push('property', { id: p.id })} className="tap shrink-0 mx-[18px] mt-3 flex items-center gap-3 rounded-[16px] bg-surface border border-line p-2 text-start">
        <PropertyArt type={p.type} seed={l.imageSeed} className="h-12 w-14 rounded-[10px] shrink-0" />
        <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold truncate">{L(l.title)}</p><p className="text-[12px] num text-goldink font-bold">{money(l.price, lang)}</p></div>
      </button>
      <div className="scroll pad py-4 grid gap-2 content-start narrow">
        {!remote && <div className="justify-self-center"><SimTag>{tx('ردود المعلن هنا محاكاة', 'Advertiser replies here are simulated')}</SimTag></div>}
        {c.messages.map((m) => {
          const parts = moderate(m.text);
          const flagged = parts.some((x) => x.bad);
          const me2 = mine(m.from);
          return (
            <div key={m.id} className={`tab-in max-w-[80%] ${me2 ? 'justify-self-end' : ''}`}>
              <div dir="auto" className={`rounded-[18px] px-3.5 py-2 text-[14.5px] ${me2 ? 'bg-primary text-onprimary rounded-se-[6px]' : 'bg-surface border border-line rounded-ss-[6px]'}`}>
                {parts.map((x, i) => x.bad ? <span key={i} className="blurword" title={tx('أخفاها فلتر الألفاظ', 'Hidden by language filter')}>{x.t}</span> : <span key={i}>{x.t}</span>)}
              </div>
              <p className={`text-[10.5px] text-muted mt-0.5 flex items-center gap-1 ${me2 ? 'justify-end' : ''}`}>{flagged && <><EyeOff size={10} />{tx('أُخفيت ألفاظ', 'Language hidden')} · </>}{time(m.at, lang)}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="shrink-0 border-t border-line bg-bg pad py-2.5 grid gap-1.5 safe-bottom" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {hasBad(text) && <p className="text-[11.5px] text-warn">{tx('رسالتك تحتوي كلمات ستُخفى عن الطرف الآخر.', 'Some words will be hidden from the other person.')}</p>}
        <div className="flex gap-2">
          <input id="m-chat-input" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={tx('اكتب رسالة…', 'Write a message…')}
            className="min-w-0 flex-1 h-12 rounded-[16px] bg-surface border border-line px-4 text-[14.5px] outline-none focus:border-gold" />
          <button type="submit" aria-label={tx('إرسال', 'Send')} disabled={!text.trim()} className="tap h-12 w-12 rounded-[16px] bg-primary text-onprimary grid place-items-center disabled:opacity-40">
            <Send size={18} className={lang === 'ar' ? '-scale-x-100' : ''} />
          </button>
        </div>
      </form>
    </div>
  );
}
