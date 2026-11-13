import { Bath, BedDouble, Heart, Layers, MapPin, Ruler } from 'lucide-react';
import { districtById, TYPE_LABEL } from '../data/seed';
import { useStore } from '../lib/store';
import type { Group } from '../lib/selectors';
import { Badge, Price, num } from './ui';
import { PropertyArt } from './PropertyArt';

export function FavButton({ propertyId, className = '' }: { propertyId: string; className?: string }) {
  const { s, ops, me, t } = useStore();
  const on = (s.favorites[me.id] ?? []).includes(propertyId);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? t('fav_remove') : t('fav_add')}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation();
        void ops.toggleFavorite(propertyId);
      }}
      className={`press grid place-items-center h-9 w-9 rounded-full bg-[#F8F6F1]/95 shadow-sm ${className}`}>
      <Heart size={17} className={on ? 'fill-[#B23434] text-[#B23434]' : 'text-[#172B45]'} />
    </button>
  );
}

export function PropertyCard({ g, reason }: { g: Group; reason?: string }) {
  const { t, L, lang } = useStore();
  const p = g.property, l = g.best;
  const d = districtById(p.districtId);
  return (
    <a href={`#property-${p.id}`} className="lift group block rounded-card border border-line bg-surface overflow-hidden hover:shadow-card min-w-0">
      <div className="relative aspect-[5/3] overflow-hidden">
        <PropertyArt type={p.type} seed={l.imageSeed} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute top-2.5 start-2.5 flex flex-wrap gap-1.5">
          <Badge tone="navy">{l.deal === 'sale' ? t('for_sale') : t('for_rent')}</Badge>
          {l.featured && <Badge tone="gold" className="bg-[#B69B72] text-[#172B45]">{t('featured')}</Badge>}
        </div>
        <FavButton propertyId={p.id} className="absolute top-2.5 end-2.5" />
        {g.listings.length > 1 && (
          <span className="absolute bottom-2.5 start-2.5 inline-flex items-center gap-1 rounded-full bg-[#172B45]/90 text-[#F8F6F1] px-2.5 py-1 text-[12px] font-semibold">
            <Layers size={13} className="text-[#B69B72]" />
            {num(g.listings.length, lang)} {t('offers_from')}
          </span>
        )}
      </div>
      <div className="p-4 grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Price n={l.price} deal={l.deal} lang={lang} className="text-[17px]" />
          <span className="text-xs text-muted">{L(TYPE_LABEL[p.type])}</span>
        </div>
        <p className="font-semibold leading-snug line-clamp-1">{L(l.title)}</p>
        <p className="flex items-center gap-1 text-sm text-muted"><MapPin size={14} />{L(d.name)}، {lang === 'ar' ? 'الرياض' : 'Riyadh'}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted pt-2 border-t border-line num">
          <span className="inline-flex items-center gap-1"><Ruler size={14} />{num(p.area, lang)} {lang === 'ar' ? 'م²' : 'm²'}</span>
          {p.rooms > 0 && <span className="inline-flex items-center gap-1"><BedDouble size={14} />{num(p.rooms, lang)}</span>}
          {p.baths > 0 && <span className="inline-flex items-center gap-1"><Bath size={14} />{num(p.baths, lang)}</span>}
          {p.identity === 'simulated_verified'
            ? <span className="ms-auto text-[11.5px] text-good font-semibold">{t('land_linked')}</span>
            : <span className="ms-auto text-[11.5px]">{t('no_land_code')}</span>}
        </div>
        {reason && <p className="text-[12.5px] text-goldink">{reason}</p>}
      </div>
    </a>
  );
}
