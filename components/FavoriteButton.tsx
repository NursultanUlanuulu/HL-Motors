'use client';
import { useFavorites } from './FavoritesProvider';
import { useLocale } from './LocaleProvider';
import { MarketIcon } from './MarketIcon';

export function FavoriteButton({ id, label = false }: { id: string; label?: boolean }) {
  const { ids, ready, toggle } = useFavorites();
  const { t } = useLocale();
  const selected = ids.includes(id);
  const text = t(selected ? 'Убрать из избранного' : 'Добавить в избранное');
  return <button type="button" className={`market-favorite ${selected ? 'selected' : ''} ${label ? 'with-label' : ''}`} disabled={!ready} aria-label={text} aria-pressed={selected} title={text} onClick={() => toggle(id)}><MarketIcon name="heart" fill={selected ? 'currentColor' : 'none'} />{label && <span>{t(selected ? 'В избранном' : 'В избранное')}</span>}</button>;
}
