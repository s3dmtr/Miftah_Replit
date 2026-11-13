import { Check, Minus, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { districtById, FEATURE_LABEL, POI_LABEL, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import { fmt, isArabic, respond, type AgentReply, type Prefs } from '../lib/agent';
import { Badge, Price, num } from '../components/ui';
import { PropertyArt } from '../components/PropertyArt';
import type { Lang } from '../types';
import { api } from '../lib/api';

let pendingPrompt: string | null = null;
export const setPendingPrompt = (q: string) => { pendingPrompt = q; };

type Turn = { role: 'user'; text: string } | { role: 'agent'; reply: AgentReply; lang: Lang };

export function AgentPage() {
  const { s, t, L, lang, remote } = useStore();
  // Backend mode: what the server reports about its agent (rule-based or OpenAI, and any missing configuration).
  const [status, setStatus] = useState<{ mode: string; missingConfig: string[] } | null>(null);
  useEffect(() => { if (remote) api('GET', '/agent/status').then(setStatus).catch(() => setStatus(null)); }, [remote]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setTurns((x) => [...x, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    const replyLang: Lang = isArabic(q) ? 'ar' : /[a-z]/i.test(q) ? 'en' : lang;
    if (remote) {
      // Ranked from PostgreSQL listings by the MIFTAH API (OpenAI-assisted when configured).
      api<{ reply: AgentReply; meta: { mode: string; missingConfig: string[] } }>('POST', '/agent/chat', { message: q, prefs })
        .then(({ reply, meta }) => {
          setPrefs(reply.prefs);
          setStatus(meta);
          setTurns((x) => [...x, { role: 'agent', reply, lang: replyLang }]);
        })
        .catch((e) => setTurns((x) => [...x, { role: 'agent', lang: replyLang, reply: { text: { ar: `${t('agent_error')} (${e.message})`, en: `${t('agent_error')} (${e.message})` }, matches: [], prefs, chips: [] } }]))
        .finally(() => setTyping(false));
      return;
    }
    window.setTimeout(() => {
      const reply = respond(s, q, prefs);
      setPrefs(reply.prefs);
      setTurns((x) => [...x, { role: 'agent', reply, lang: replyLang }]);
      setTyping(false);
    }, 650);
  };

  useEffect(() => {
    if (pendingPrompt) { const q = pendingPrompt; pendingPrompt = null; send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, typing]);

  const understood: string[] = [];
  if (prefs.deal) understood.push(prefs.deal === 'sale' ? t('buy') : t('rent'));
  prefs.types?.forEach((x) => understood.push(L(TYPE_LABEL[x])));
  if (prefs.category) understood.push(t(prefs.category));
  if (prefs.budgetMax) understood.push(`${prefs.budgetMin ? fmt(prefs.budgetMin, lang) + ' – ' : '≤ '}${fmt(prefs.budgetMax, lang)}`);
  prefs.districts?.forEach((d) => understood.push(L(districtById(d).name)));
  if (prefs.roomsMin) understood.push(`${num(prefs.roomsMin, lang)}+ ${t('rooms')}`);
  if (prefs.areaMin) understood.push(`${num(prefs.areaMin, lang)}+ ${lang === 'ar' ? 'م²' : 'm²'}`);
  prefs.amenities?.forEach((a) => understood.push(`${t('near')} ${L(POI_LABEL[a])}`));
  prefs.features?.forEach((f) => understood.push(L(FEATURE_LABEL[f])));

  const lastAgent = [...turns].reverse().find((x) => x.role === 'agent') as Extract<Turn, { role: 'agent' }> | undefined;
  const chips = lastAgent ? lastAgent.reply.chips.map((c) => c[lastAgent.lang]) : [t('sample_q1'), t('sample_q2'), t('sample_q3')];

  return (
    <div className="gutter mx-auto max-w-[1200px] py-6 grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 rounded-card border border-line bg-surface flex flex-col min-h-[70vh]">
        <div className="flex items-center gap-3 p-4 border-b border-line">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-primary text-onprimary"><Sparkles size={18} /></span>
          <div className="min-w-0">
            <p className="font-bold">{t('agent_title')}</p>
            <p className="text-xs text-muted">{!remote ? t('agent_demo_note') : status?.mode.startsWith('openai') ? t('agent_live_ai') : t('agent_live_rule')}</p>
          </div>
          {remote ? <Badge tone="good" className="ms-auto">{t('live_db')}</Badge> : <Badge tone="demo" className="ms-auto">{t('simulated')}</Badge>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid gap-4 content-start" aria-live="polite">
          {turns.length === 0 && (
            <div className="rounded-card bg-band/50 p-5">
              <p className="font-bold">{t('agent_welcome')}</p>
              <p className="text-sm text-muted mt-1">{t('agent_welcome_sub')}</p>
            </div>
          )}
          {turns.map((x, i) => x.role === 'user' ? (
            <div key={i} className="justify-self-end max-w-[85%] rounded-[14px] rounded-se-[4px] bg-primary text-onprimary px-4 py-2.5 text-[14.5px] rise" dir="auto">{x.text}</div>
          ) : (
            <div key={i} className="max-w-full grid gap-3 rise" dir={x.lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="max-w-[90%] rounded-[14px] rounded-ss-[4px] bg-band px-4 py-2.5 text-[14.5px] w-fit">{x.reply.text[x.lang]}</div>
              {x.reply.matches.map((m) => (
                <a key={m.listing.id} href={`#property-${m.property.id}`} className="lift block rounded-card border border-line bg-surface overflow-hidden hover:shadow-card">
                  <div className="grid sm:grid-cols-[180px_1fr]">
                    <PropertyArt type={m.property.type} seed={m.listing.imageSeed} className="h-36 sm:h-full w-full" />
                    <div className="p-3.5 min-w-0 grid gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold leading-snug">{m.listing.title[x.lang]}</p>
                        <span className="shrink-0 rounded-full bg-gold/20 text-goldink text-[12px] font-bold px-2 py-0.5 num">{num(Math.round(m.score * 100), x.lang)}{x.lang === 'ar' ? '٪' : '%'} {x.lang === 'ar' ? 'تطابق' : 'match'}</span>
                      </div>
                      <Price n={m.listing.price} deal={m.listing.deal} lang={x.lang} />
                      {m.offers > 1 && <p className="text-xs text-goldink font-semibold">{num(m.offers, x.lang)} {x.lang === 'ar' ? 'عروض لنفس العقار — قارن الأسعار' : 'offers for this property — compare prices'}</p>}
                      <ul className="grid gap-1 mt-1">
                        {m.criteria.map((c, k) => (
                          <li key={k} className="flex items-start gap-1.5 text-[13px]">
                            {c.ok === 'yes' ? <Check size={15} className="text-good mt-0.5 shrink-0" /> : c.ok === 'partial' ? <Minus size={15} className="text-warn mt-0.5 shrink-0" /> : <X size={15} className="text-bad mt-0.5 shrink-0" />}
                            <span>{c.text[x.lang]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </a>
              ))}
              {x.reply.matches.length > 0 && <p className="text-[12px] text-muted">{x.lang === 'ar' ? 'لا نضمن تطابقاً تاماً. المسافات والخدمات القريبة من بيانات تجريبية.' : 'A perfect match is not guaranteed. Distances and nearby places use demo data.'}</p>}
            </div>
          ))}
          {typing && (
            <div className="w-fit rounded-[14px] bg-band px-4 py-3 flex gap-1">
              {[0, 1, 2].map((k) => <span key={k} className="h-2 w-2 rounded-full bg-muted" style={{ animation: `dot 1.2s ${k * 0.15}s infinite` }} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line p-3 grid gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => <button key={c} type="button" onClick={() => send(c)} className="press shrink-0 rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] font-semibold hover:border-gold">{c}</button>)}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input id="agent-input" dir="auto" className="field h-11" placeholder={t('agent_placeholder')} value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" aria-label={t('send')} className="press h-11 w-11 shrink-0 grid place-items-center rounded-ctl bg-primary text-onprimary disabled:opacity-40" disabled={!input.trim() || typing}>
              <Send size={18} className={lang === 'ar' ? '-scale-x-100' : ''} />
            </button>
          </form>
        </div>
      </div>

      <aside className="grid gap-4 content-start">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('understood')}</p>
          {understood.length ? <div className="flex flex-wrap gap-1.5 mt-2">{understood.map((u) => <Badge key={u}>{u}</Badge>)}</div> : <p className="text-sm text-muted mt-2">{t('understood_none')}</p>}
        </div>
        <div className="rounded-card border border-line bg-surface p-4 text-sm grid gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('agent_rules')}</p>
          <p>{t('agent_rule1')}</p><p>{t('agent_rule2')}</p><p>{t('agent_rule3')}</p>
        </div>
      </aside>
    </div>
  );
}
