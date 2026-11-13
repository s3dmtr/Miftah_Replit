import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Empty, Price, dateFmt, money, num } from '../components/ui';
import { StatusBadge } from './Dashboard';
import { districtById, TYPE_LABEL } from '../data/seed';

type Tab = 'status' | 'verify' | 'ads' | 'properties' | 'reports' | 'duplicates' | 'transactions' | 'users' | 'log';

export function AdminPage() {
  const { s, ops, t, L, lang, me } = useStore();
  const isAdmin = me.role === 'admin';
  const [tab, setTab] = useState<Tab>('status');
  if (me.role !== 'admin' && me.role !== 'supervisor') return <div className="gutter mx-auto max-w-[1200px] py-6"><Empty title={t('staff_only')} /></div>;

  const pendingSR = s.statusRequests.filter((r) => r.state === 'pending');
  const pendingV = s.advertisers.filter((a) => a.verified === 'pending');
  const openR = s.reports.filter((r) => r.open);
  const tabs: [Tab, string, number?, boolean?][] = [
    ['status', t('status_reviews'), pendingSR.length],
    ['verify', t('verification'), pendingV.length, true],
    ['reports', t('reports'), openR.length],
    ['duplicates', t('duplicates'), s.duplicates.length],
    ['ads', t('all_ads'), undefined, true],
    ['properties', t('property_records'), undefined, true],
    ['transactions', t('transactions'), undefined, true],
    ['users', t('users'), undefined, true],
    ['log', t('activity_log')],
  ];
  const visible = tabs.filter((x) => isAdmin || !x[3]);
  const nm = (id: string) => { const a = s.advertisers.find((x) => x.id === id); if (a) return L(a.name); const u = s.users.find((x) => x.id === id); return u ? L(u.name) : id; };

  return (
    <div className="gutter mx-auto max-w-[1200px] py-6 grid gap-6">
      <div>
        <p className="text-sm text-muted">{t(`role_${me.role}` as never)}</p>
        <h1 className="text-2xl font-bold">{isAdmin ? t('admin_title') : t('supervisor_title')}</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[[t('active_ads'), s.listings.filter((l) => l.status === 'active').length], [t('property_records'), s.properties.length], [t('status_reviews'), pendingSR.length], [t('reports'), openR.length]].map(([k, v]) => (
          <div key={k as string} className="rounded-card border border-line bg-surface p-4"><p className="text-xs text-muted">{k}</p><p className="text-2xl font-bold num mt-1">{num(v as number, lang)}</p></div>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {visible.map(([id, label, n]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`press relative shrink-0 px-3.5 h-10 text-sm font-semibold inline-flex items-center gap-1.5 ${tab === id ? 'text-ink' : 'text-muted'}`}>
            {label}{!!n && <span className="grid place-items-center h-5 min-w-5 px-1 rounded-full bg-gold/25 text-goldink text-[11px] num">{num(n, lang)}</span>}
            {tab === id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold" />}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div className="grid gap-4">
          <p className="text-sm text-muted max-w-[75ch]">{t('status_explain')}</p>
          {pendingSR.length === 0 && <Empty title={t('nothing_pending')} />}
          {pendingSR.map((r) => {
            const p = s.properties.find((x) => x.id === r.propertyId)!;
            const affected = s.listings.filter((l) => l.propertyId === p.id && l.status !== 'closed');
            const l = s.listings.find((x) => x.id === r.listingId)!;
            return (
              <Card key={r.id} className="p-4 grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`#property-${p.id}`} className="font-semibold hover:underline">{L(l.title)}</a>
                  <Badge tone="warn">{r.outcome === 'sold' ? t('claim_sold') : t('claim_rented')}</Badge>
                  <Badge tone="demo">{p.landCode ?? t('no_land_code')}</Badge>
                </div>
                <p className="text-sm text-muted">{t('requested_by')} {nm(r.advertiserId)} · {dateFmt(r.at, lang)} · {t('declared_value')} <span className="num font-semibold text-ink">{money(r.value, lang)}</span></p>
                <div className="rounded-ctl bg-band/50 p-3 text-sm">
                  <p className="font-semibold">{t('will_close')} {num(affected.length, lang)} {t('ads_word')}:</p>
                  <ul className="mt-1 grid gap-0.5">{affected.map((a) => <li key={a.id} className="flex justify-between gap-3"><span>{nm(a.advertiserId)}</span><span className="num">{money(a.price, lang)}</span></li>)}</ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="good" onClick={() => void ops.reviewStatus(r.id, true)}>{t('verify_approve')}</Button>
                  <Button variant="secondary" onClick={() => void ops.reviewStatus(r.id, false)}>{t('reject')}</Button>
                </div>
              </Card>
            );
          })}
          {s.history.length > 0 && (
            <div>
              <p className="font-bold mb-2">{t('status_history')}</p>
              <Table head={[t('property'), t('change'), t('by'), t('date')]} rows={s.history.map((h) => {
                const p = s.properties.find((x) => x.id === h.propertyId)!;
                return [p.landCode ?? p.id, `${t(`avail_${h.from}` as never)} → ${t(`avail_${h.to}` as never)}`, nm(h.by), dateFmt(h.at, lang)];
              })} />
            </div>
          )}
        </div>
      )}

      {tab === 'verify' && (
        <div className="grid gap-3">
          {pendingV.length === 0 && <Empty title={t('nothing_pending')} />}
          {pendingV.map((a) => (
            <Card key={a.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 me-auto">
                <p className="font-semibold">{L(a.name)}</p>
                <p className="text-sm text-muted">{t(`adv_${a.type}` as never)} · {t('fal')} <span className="num">{a.license ?? '—'}</span> · {dateFmt(a.joined, lang)}</p>
                <p className="text-xs text-muted mt-0.5">{t('rega_sim')}</p>
              </div>
              <Button variant="good" size="sm" onClick={() => void ops.verifyAdvertiser(a.id, true)}>{t('approve')}</Button>
              <Button variant="secondary" size="sm" onClick={() => void ops.verifyAdvertiser(a.id, false)}>{t('reject')}</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid gap-3">
          {openR.length === 0 && <Empty title={t('nothing_pending')} />}
          {openR.map((r) => {
            const l = s.listings.find((x) => x.id === r.listingId)!;
            return (
              <Card key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 me-auto">
                  <a href={`#property-${l.propertyId}`} className="font-semibold hover:underline">{L(l.title)}</a>
                  <p className="text-sm text-muted">“{r.reason}” · {nm(r.by)} · {dateFmt(r.at, lang)}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void ops.resolveReport(r.id, true)}>{t('pause_ad')}</Button>
                <Button size="sm" variant="ghost" onClick={() => void ops.resolveReport(r.id, false)}>{t('dismiss')}</Button>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'duplicates' && (
        s.duplicates.length
          ? <Table head={[t('advertiser'), t('land_code'), t('existing_ad'), t('date')]} rows={s.duplicates.map((d) => [nm(d.advertiserId), d.landCode, d.existingListingId, dateFmt(d.at, lang)])} />
          : <Empty title={t('no_duplicates')} sub={t('no_duplicates_sub')} />
      )}

      {tab === 'ads' && (
        <div className="scroll-x rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-band/60"><tr className="text-[12px] uppercase tracking-wider text-muted">{[t('ad'), t('advertiser'), t('price'), t('status'), t('visits'), ''].map((h, i) => <th key={i} className="text-start font-semibold p-3">{h}</th>)}</tr></thead>
            <tbody>
              {s.listings.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="p-3"><a href={`#property-${l.propertyId}`} className="hover:underline">{L(l.title)}</a></td>
                  <td className="p-3">{nm(l.advertiserId)}</td>
                  <td className="p-3"><Price n={l.price} deal={l.deal} lang={lang} /></td>
                  <td className="p-3"><StatusBadge l={l} /></td>
                  <td className="p-3 num">{num(l.views, lang)}</td>
                  <td className="p-3">
                    {l.status === 'active' && <Button size="sm" variant="ghost" onClick={() => void ops.updateListing(l.id, { status: 'paused' })}>{t('pause')}</Button>}
                    {l.status === 'paused' && <Button size="sm" variant="ghost" onClick={() => void ops.updateListing(l.id, { status: 'active' })}>{t('resume')}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'properties' && (
        <Table head={[t('land_code'), t('property_type'), t('district'), t('identity'), t('ads_word'), t('availability')]}
          rows={s.properties.map((p) => [p.landCode ?? '—', L(TYPE_LABEL[p.type]), L(districtById(p.districtId).name), p.identity === 'simulated_verified' ? t('identity_sim') : t('identity_none'), num(s.listings.filter((l) => l.propertyId === p.id).length, lang), t(`avail_${p.availability}` as never)])} />
      )}

      {tab === 'transactions' && (
        <div className="grid gap-3">
          <p className="text-sm text-warn">{t('no_real_payments')}</p>
          {s.transactions.length
            ? <Table head={[t('advertiser'), t('transaction_value'), t('platform_commission'), t('rule'), t('date')]} rows={s.transactions.map((x) => [nm(x.advertiserId), money(x.value, lang), money(Math.round(x.commission), lang), x.rule, dateFmt(x.at, lang)])} />
            : <Empty title={t('no_transactions')} sub={t('no_transactions_sub')} />}
        </div>
      )}

      {tab === 'users' && (
        <Table head={[t('name'), t('role'), t('verification')]}
          rows={[...s.users.map((u) => [L(u.name), t(`role_${u.role}` as never), u.advertiserId ? (s.advertisers.find((a) => a.id === u.advertiserId)!.verified === 'verified' ? t('verified') : t('pending')) : '—']),
            ...s.advertisers.filter((a) => !s.users.some((u) => u.advertiserId === a.id)).map((a) => [L(a.name), t(`adv_${a.type}` as never), a.verified === 'verified' ? t('verified') : a.verified === 'pending' ? t('pending') : t('rejected')])]} />
      )}

      {tab === 'log' && (
        s.adminLog.length ? <Table head={[t('by'), t('action'), t('date')]} rows={s.adminLog.map((a) => [nm(a.by), a.action, dateFmt(a.at, lang)])} /> : <Empty title={t('no_activity')} />
      )}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="scroll-x rounded-card border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-band/60"><tr className="text-[12px] uppercase tracking-wider text-muted">{head.map((h) => <th key={h} className="text-start font-semibold p-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="p-3 num">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
