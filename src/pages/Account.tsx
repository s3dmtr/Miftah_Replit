import { useState } from 'react';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { Button, Card, Field } from '../components/ui';
import type { Role } from '../types';

const ROLES: Role[] = ['seeker', 'owner', 'company', 'marketer'];

export function AccountPage() {
  const { s, ops, t, L } = useStore();
  const [err, setErr] = useState('');
  const [role, setRole] = useState<Role>('seeker');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [license, setLicense] = useState('');
  const [cr, setCr] = useState('');
  const needsLicense = role === 'company' || role === 'marketer';
  const ok = name.trim() && /^05\d{8}$/.test(phone) && (!needsLicense || license.trim()) && (role !== 'company' || cr.trim());

  const submit = async () => {
    try {
      await ops.register({ name, phone, role, license, crNumber: cr });
      go(role === 'seeker' ? 'home' : 'dashboard');
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="gutter mx-auto max-w-[1200px] py-8 grid gap-6 lg:grid-cols-[1.2fr_1fr] items-start">
      <Card className="p-6 grid gap-5">
        <div>
          <h1 className="text-2xl font-bold">{t('register_title')}</h1>
          <p className="text-sm text-muted mt-1">{t('register_sub')}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROLES.map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`press rounded-ctl border p-3 text-start ${role === r ? 'border-gold bg-gold/10' : 'border-line'}`}>
              <span className="block text-sm font-bold">{t(`role_${r}` as never)}</span>
              <span className="block text-[11.5px] text-muted mt-0.5">{t(`role_${r}_sub` as never)}</span>
            </button>
          ))}
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (ok) void submit(); }}>
          <Field label={role === 'company' ? t('company_name') : t('full_name')}><input id="r-name" className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t('mobile')} hint="05XXXXXXXX"><input id="r-phone" inputMode="tel" dir="ltr" className="field num" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field>
          {needsLicense && <Field label={t('fal')} hint={t('rega_sim')}><input id="r-lic" dir="ltr" className="field num uppercase" placeholder="DEMO-FAL-…" value={license} onChange={(e) => setLicense(e.target.value)} /></Field>}
          {role === 'company' && <Field label={t('cr_number')} hint={t('wathq_sim')}><input id="r-cr" dir="ltr" inputMode="numeric" className="field num" value={cr} onChange={(e) => setCr(e.target.value.replace(/\D/g, ''))} /></Field>}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!ok}>{t('create_account')}</Button>
            <span className="text-xs text-muted">{role === 'seeker' ? t('seeker_free') : role === 'owner' ? t('owner_instant') : t('needs_review')}</span>
            {err && <span className="text-xs text-bad font-semibold">{err}</span>}
          </div>
        </form>
      </Card>
      <Card className="p-6 grid gap-3">
        <p className="font-bold">{t('demo_accounts')}</p>
        <p className="text-sm text-muted">{t('demo_accounts_sub')}</p>
        {s.users.map((u) => (
          <button key={u.id} type="button" onClick={async () => { await ops.switchUser(u.id); go(u.role === 'admin' || u.role === 'supervisor' ? 'admin' : u.advertiserId ? 'dashboard' : 'home'); }}
            className="press flex items-center justify-between gap-3 rounded-ctl border border-line p-3 hover:border-gold text-start">
            <span className="min-w-0"><span className="block font-semibold truncate">{L(u.name)}</span><span className="block text-xs text-muted">{t(`role_${u.role}` as never)}</span></span>
            <span className="text-goldink text-sm font-semibold">{t('sign_in')}</span>
          </button>
        ))}
      </Card>
    </div>
  );
}
