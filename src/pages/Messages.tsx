import { ArrowLeft, ArrowRight, EyeOff, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { hasBad, moderate } from '../lib/moderation';
import { Empty } from '../components/ui';
import { PropertyArt } from '../components/PropertyArt';

const AUTO_REPLIES = [
  { ar: 'شكراً لتواصلك، سأرد عليك بالتفاصيل قريباً.', en: 'Thanks for reaching out, I will reply with details shortly.' },
  { ar: 'نعم العرض ما زال متاحاً، متى يناسبك موعد المعاينة؟', en: 'Yes, the offer is still available. When would suit you for a viewing?' },
];

export function MessagesPage({ convId }: { convId?: string }) {
  const { s, act, ops, remote, t, L, lang, me } = useStore();
  const mineKey = me.advertiserId ?? me.id;
  const convs = s.conversations.filter((c) => c.seekerId === me.id || (me.advertiserId && c.advertiserId === me.advertiserId));
  const current = convs.find((c) => c.id === convId) ?? (window.innerWidth >= 1024 ? convs[0] : undefined);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [current?.messages.length, current?.id]);

  const send = () => {
    const v = text.trim();
    if (!v || !current) return;
    const asAdvertiser = me.advertiserId === current.advertiserId && current.seekerId !== me.id;
    void ops.sendMessage(current.id, v);
    setText('');
    // Simulated advertiser reply only in the offline prototype; with the API, real replies come from the advertiser account.
    if (!asAdvertiser && !remote) {
      window.setTimeout(() => act((d) => {
        const c = d.conversations.find((x) => x.id === current.id)!;
        const r = AUTO_REPLIES[c.messages.length % 2];
        c.messages.push({ id: `m${Date.now().toString(36)}r`, from: c.advertiserId, text: r[lang], at: new Date().toISOString() });
        d.notices.unshift({ id: `n${Date.now().toString(36)}`, to: me.id, text: { ar: 'رسالة جديدة من المعلن.', en: 'New message from the advertiser.' }, at: new Date().toISOString(), read: false });
      }), 1400);
    }
  };

  const list = (
    <div className="grid content-start">
      {convs.map((c) => {
        const l = s.listings.find((x) => x.id === c.listingId)!;
        const p = s.properties.find((x) => x.id === l.propertyId)!;
        const other = c.seekerId === me.id ? L(s.advertisers.find((a) => a.id === c.advertiserId)!.name) : L(s.users.find((u) => u.id === c.seekerId)?.name ?? { ar: 'باحث', en: 'Seeker' });
        const last = c.messages[c.messages.length - 1];
        return (
          <a key={c.id} href={`#chat-${c.id}`} className={`press flex items-center gap-3 p-3 border-b border-line ${current?.id === c.id ? 'bg-band/60' : 'hover:bg-band/30'}`}>
            <PropertyArt type={p.type} seed={l.imageSeed} className="h-11 w-14 rounded-[8px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{other}</p>
              <p className="text-xs text-muted truncate">{last ? last.text : L(l.title)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );

  if (!convs.length) return <div className="gutter mx-auto max-w-[1200px] py-6"><Empty title={t('no_conversations')} sub={t('no_conversations_sub')} /></div>;

  return (
    <div className="gutter mx-auto max-w-[1200px] py-6">
      <h1 className="text-2xl font-bold mb-4">{t('nav_messages')}</h1>
      <div className="rounded-card border border-line bg-surface overflow-hidden grid lg:grid-cols-[320px_1fr] min-h-[65vh]">
        <div className={`border-e border-line ${current ? 'hidden lg:block' : ''}`}>{list}</div>
        {current ? (() => {
          const l = s.listings.find((x) => x.id === current.listingId)!;
          return (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-3 p-3 border-b border-line">
                <button type="button" className="press lg:hidden h-8 w-8 grid place-items-center" aria-label={t('back')} onClick={() => go('messages')}><Back size={18} /></button>
                <a href={`#property-${l.propertyId}`} className="min-w-0 hover:underline">
                  <p className="text-sm font-semibold truncate">{L(l.title)}</p>
                  <p className="text-xs text-muted">{L(s.advertisers.find((a) => a.id === current.advertiserId)!.name)}</p>
                </a>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid gap-2 content-start max-h-[60vh]">
                {current.messages.length === 0 && <p className="text-sm text-muted text-center py-8">{t('start_conversation')}</p>}
                {current.messages.map((m) => {
                  const mine = m.from === mineKey || m.from === me.id;
                  const parts = moderate(m.text);
                  const flagged = parts.some((x) => x.bad);
                  return (
                    <div key={m.id} className={`max-w-[80%] ${mine ? 'justify-self-end' : ''}`}>
                      <div dir="auto" className={`rounded-[14px] px-3.5 py-2 text-[14.5px] ${mine ? 'bg-primary text-onprimary rounded-se-[4px]' : 'bg-band rounded-ss-[4px]'}`}>
                        {parts.map((x, i) => x.bad ? <span key={i} className="blurword" title={t('hidden_word')}>{x.t}</span> : <span key={i}>{x.t}</span>)}
                      </div>
                      {flagged && <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1"><EyeOff size={11} />{t('filtered_note')}</p>}
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <form className="p-3 border-t border-line grid gap-1.5" onSubmit={(e) => { e.preventDefault(); send(); }}>
                {hasBad(text) && <p className="text-xs text-warn">{t('bad_warning')}</p>}
                <div className="flex gap-2">
                  <input id="chat-input" dir="auto" className="field h-11" placeholder={t('type_message')} value={text} onChange={(e) => setText(e.target.value)} />
                  <button type="submit" aria-label={t('send')} disabled={!text.trim()} className="press h-11 w-11 shrink-0 grid place-items-center rounded-ctl bg-primary text-onprimary disabled:opacity-40">
                    <Send size={18} className={lang === 'ar' ? '-scale-x-100' : ''} />
                  </button>
                </div>
              </form>
            </div>
          );
        })() : (
          <div className="hidden lg:grid place-items-center text-muted"><MessageCircle size={28} /></div>
        )}
      </div>
    </div>
  );
}
