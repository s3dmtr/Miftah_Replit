// AI conversational search. Offline: the shared agent ranks the embedded database snapshot in the browser.
// With VITE_API_URL: POST /api/agent/chat ranks live PostgreSQL listings (OpenAI-assisted if configured).
import { Check, ChevronDown, Minus, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { districtById, FEATURE_LABEL, POI_LABEL, TYPE_LABEL } from '../../data/seed';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { fmt, isArabic, respond, type AgentReply, type Match, type Prefs } from '../../lib/agent';
import { PropertyArt } from '../../components/PropertyArt';
import { num } from '../../components/ui';
import type { Lang } from '../../types';
import { AppHeader, IconBtn, PriceTag, SimTag, useTx } from '../kit';
import { useNav } from '../nav';

let pending: string | null = null;
export const setAgentPrompt = (q: string) => { pending = q; };
type Turn = { role: 'user'; text: string } | { role: 'agent'; reply: AgentReply; lang: Lang };

export function AgentScreen() {
  const { s, L, lang, remote } = useStore();
  const tx = useTx();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setTurns((x) => [...x, { role: 'user', text: q }]);
    setInput(''); setTyping(true);
    const rl: Lang = isArabic(q) ? 'ar' : /[a-z]/i.test(q) ? 'en' : lang;
    if (remote) {
      api<{ reply: AgentReply; meta: { mode: string } }>('POST', '/agent/chat', { message: q, prefs })
        .then(({ reply, meta }) => { setPrefs(reply.prefs); setMode(meta.mode); setTurns((x) => [...x, { role: 'agent', reply, lang: rl }]); })
        .catch((e) => setTurns((x) => [...x, { role: 'agent', lang: rl, reply: { text: { ar: `تعذّر الوصول إلى الخادم (${e.message})`, en: `Could not reach the server (${e.message})` }, matches: [], prefs, chips: [] } }]))
        .finally(() => setTyping(false));
      return;
    }
    window.setTimeout(() => {
      const reply = respond(s, q, prefs);
      setPrefs(reply.prefs);
      setTurns((x) => [...x, { role: 'agent', reply, lang: rl }]);
      setTyping(false);
    }, 700);
  };
  useEffect(() => { if (pending) { const q = pending; pending = null; send(q); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, typing]);

  const understood: string[] = [];
  if (prefs.deal) understood.push(prefs.deal === 'sale' ? tx('شراء', 'Buy') : tx('إيجار', 'Rent'));
  prefs.types?.forEach((x) => understood.push(L(TYPE_LABEL[x])));
  if (prefs.category && !prefs.types) understood.push(prefs.category === 'commercial' ? tx('تجاري', 'Commercial') : tx('سكني', 'Residential'));
  if (prefs.budgetMax) understood.push(`≤ ${fmt(prefs.budgetMax, lang)}`);
  prefs.districts?.slice(0, 3).forEach((d) => understood.push(L(districtById(d).name)));
  if ((prefs.districts?.length ?? 0) > 3) understood.push(`+${num(prefs.districts!.length - 3, lang)}`);
  if (prefs.roomsMin) understood.push(`${num(prefs.roomsMin, lang)}+ ${tx('غرف', 'beds')}`);
  prefs.amenities?.forEach((a) => understood.push(`${tx('قرب', 'near')} ${L(POI_LABEL[a])}`));
  prefs.features?.forEach((f) => understood.push(L(FEATURE_LABEL[f])));

  const last = [...turns].reverse().find((x) => x.role === 'agent') as Extract<Turn, { role: 'agent' }> | undefined;
  const chips = last ? last.reply.chips.map((c) => c[last.lang]) : [
    tx('أبي فيلا للشراء في الملقا بحدود ٤ مليون قريبة من مسجد', 'Villa to buy in Al Malqa under 4M near a masjid'),
    tx('شقة للإيجار شمال الرياض ٣ غرف حدود ٧٠ ألف', 'Apartment for rent in north Riyadh, 3 beds, up to 70K'),
    tx('محل تجاري للإيجار بالعليا', 'Shop for rent in Al Olaya'),
  ];
  const sub = remote ? (mode?.startsWith('openai') ? tx('بيانات حية · OpenAI', 'Live data · OpenAI') : tx('بيانات حية من PostgreSQL', 'Live PostgreSQL data'))
    : tx('يعمل على نسخة قاعدة البيانات · محلل قواعد', 'Database snapshot · rule-based parser');

  return (
    <div className="screen">
      <AppHeader back={false} title={<span className="inline-flex items-center gap-2"><span className="grid place-items-center h-7 w-7 rounded-full bg-[#B69B72] text-[#172B45]"><Sparkles size={14} /></span>{tx('مساعد مفتاح', 'Miftah Agent')}</span>} sub={sub}
        actions={turns.length > 0 ? <IconBtn label={tx('محادثة جديدة', 'New chat')} onClick={() => { setTurns([]); setPrefs({}); }}><RotateCcw size={18} /></IconBtn> : undefined} />
      {understood.length > 0 && (
        <div className="hscroll gap-1.5 px-[18px] py-2 border-b border-line bg-bg shrink-0">
          <span className="text-[11.5px] text-muted self-center whitespace-nowrap">{tx('فهمت:', 'Understood:')}</span>
          {understood.map((u) => <span key={u} className="rounded-full bg-band px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap">{u}</span>)}
        </div>
      )}
      <div className="scroll pad py-4 grid gap-4 content-start narrow" aria-live="polite">
        {turns.length === 0 && (
          <div className="grid justify-items-center text-center gap-3 pt-6 pb-2">
            <span className="grid place-items-center h-16 w-16 rounded-[22px] bg-[#172B45] text-[#B69B72] shadow-[0_10px_30px_rgba(23,43,69,.3)]"><Sparkles size={28} /></span>
            <p className="text-[20px] font-bold">{tx('صف عقارك المثالي', 'Describe your ideal property')}</p>
            <p className="text-[13.5px] text-muted max-w-[32ch]">{tx('اكتب بالعربية أو الإنجليزية. سأسأل عن الميزانية والحي، ثم أرتّب العقارات وأشرح سبب كل ترشيح، مع المسافة إلى المسجد والمدارس والمستشفى.', 'Write in Arabic or English. I will ask about budget and district, rank properties, and explain each match, including distance to masjids, schools and hospitals.')}</p>
            <div className="flex flex-wrap justify-center gap-1.5"><SimTag>{tx('لا نضمن تطابقاً تاماً', 'No perfect match guaranteed')}</SimTag>{!remote && <SimTag>{tx('بدون OpenAI', 'No OpenAI')}</SimTag>}</div>
          </div>
        )}
        {turns.map((x, i) => x.role === 'user' ? (
          <div key={i} dir="auto" className="tab-in justify-self-end max-w-[84%] rounded-[20px] rounded-se-[6px] bg-primary text-onprimary px-4 py-2.5 text-[14.5px]">{x.text}</div>
        ) : (
          <div key={i} className="tab-in grid gap-2.5" dir={x.lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="max-w-[88%] w-fit rounded-[20px] rounded-ss-[6px] bg-surface border border-line px-4 py-2.5 text-[14.5px]">{x.reply.text[x.lang]}</div>
            {x.reply.matches.map((m, k) => <MatchCard key={m.listing.id} m={m} l={x.lang} rank={k + 1} />)}
          </div>
        ))}
        {typing && <div className="w-fit rounded-[20px] bg-surface border border-line px-4 py-3.5 flex gap-1.5">{[0, 1, 2].map((k) => <span key={k} className="h-2 w-2 rounded-full bg-gold" style={{ animation: `dot 1.2s ${k * 0.15}s infinite` }} />)}</div>}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-line bg-bg pt-2 pb-9">
        <div className="hscroll gap-2 px-[18px] pb-2">
          {chips.map((c) => <button key={c} type="button" onClick={() => send(c)} className="tap h-8 px-3 rounded-full border border-line bg-surface text-[12.5px] font-semibold whitespace-nowrap">{c}</button>)}
        </div>
        <form className="pad flex gap-2 narrow" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input id="m-agent-input" dir="auto" value={input} onChange={(e) => setInput(e.target.value)} placeholder={tx('اكتب طلبك…', 'Type your request…')}
            className="min-w-0 flex-1 h-12 rounded-[16px] bg-surface border border-line px-4 text-[14.5px] outline-none focus:border-gold" />
          <button type="submit" aria-label={tx('إرسال', 'Send')} disabled={!input.trim() || typing} className="tap h-12 w-12 rounded-[16px] bg-primary text-onprimary grid place-items-center disabled:opacity-40">
            <Send size={18} className={lang === 'ar' ? '-scale-x-100' : ''} />
          </button>
        </form>
      </div>
    </div>
  );
}

function MatchCard({ m, l, rank }: { m: Match; l: Lang; rank: number }) {
  const nav = useNav();
  const [open, setOpen] = useState(rank === 1);
  const ar = l === 'ar';
  const pct = Math.round(m.score * 100);
  return (
    <div className="rounded-[20px] bg-surface border border-line overflow-hidden">
      <button type="button" onClick={() => nav.push('property', { id: m.property.id })} className="tap w-full flex gap-3 p-2.5 text-start">
        <div className="relative h-[86px] w-[100px] shrink-0 rounded-[14px] overflow-hidden">
          <PropertyArt type={m.property.type} seed={m.listing.imageSeed} className="h-full w-full" />
          <span className="absolute top-1.5 start-1.5 h-6 w-6 rounded-full bg-[#172B45] text-[#F8F6F1] grid place-items-center text-[11px] font-bold num">{num(rank, l)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-[14px] leading-snug line-clamp-2">{m.listing.title[l]}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold num ${pct >= 80 ? 'bg-good/15 text-good' : 'bg-gold/20 text-goldink'}`}>{num(pct, l)}{ar ? '٪' : '%'}</span>
          </div>
          <PriceTag n={m.listing.price} deal={m.listing.deal} className="text-[14px] mt-1 block" />
          {m.offers > 1 && <p className="text-[11.5px] text-goldink font-semibold mt-0.5">{num(m.offers, l)} {ar ? 'عروض لنفس العقار' : 'offers for this property'}</p>}
        </div>
      </button>
      <button type="button" onClick={() => setOpen(!open)} className="tap w-full flex items-center justify-between px-3.5 py-2 border-t border-line text-[12.5px] font-semibold text-muted">
        {ar ? 'لماذا هذا الترشيح؟' : 'Why this match?'}<ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="px-3.5 pb-3 grid gap-1">
          {m.criteria.map((c, k) => (
            <li key={k} className="flex items-start gap-1.5 text-[12.5px]">
              {c.ok === 'yes' ? <Check size={14} className="text-good mt-0.5 shrink-0" /> : c.ok === 'partial' ? <Minus size={14} className="text-warn mt-0.5 shrink-0" /> : <X size={14} className="text-bad mt-0.5 shrink-0" />}
              <span>{c.text[l]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
