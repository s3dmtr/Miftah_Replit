import { Heart } from 'lucide-react';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { publicGroups } from '../lib/selectors';
import { Button, Empty, SectionTitle, Badge, num } from '../components/ui';
import { PropertyCard } from '../components/PropertyCard';

export function FavoritesPage() {
  const { s, t, me, L, lang } = useStore();
  const ids = s.favorites[me.id] ?? [];
  const groups = publicGroups(s).filter((g) => ids.includes(g.property.id));
  const unavailable = s.properties.filter((p) => ids.includes(p.id) && !groups.some((g) => g.property.id === p.id));
  return (
    <div className="gutter mx-auto max-w-[1200px] py-6">
      <SectionTitle title={t('nav_favorites')} sub={`${num(ids.length, lang)} ${t('saved_count')}`} />
      {ids.length === 0
        ? <Empty title={t('fav_empty')} sub={t('fav_empty_sub')} action={<Button onClick={() => go('search')}><Heart size={16} />{t('nav_search')}</Button>} />
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <PropertyCard key={g.property.id} g={g} />)}</div>}
      {unavailable.length > 0 && (
        <div className="mt-8 grid gap-2">
          <p className="font-bold">{t('fav_unavailable')}</p>
          {unavailable.map((p) => {
            const l = s.listings.find((x) => x.propertyId === p.id)!;
            return (
              <a key={p.id} href={`#property-${p.id}`} className="press flex items-center gap-3 rounded-ctl border border-line bg-surface p-3">
                <span className="min-w-0 flex-1 truncate">{L(l.title)}</span>
                <Badge tone="warn">{p.availability === 'sold' ? t('status_sold') : p.availability === 'rented' ? t('status_rented') : t('status_paused')}</Badge>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
