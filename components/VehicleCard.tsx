'use client';
import Link from 'next/link';
import { useLocale } from './LocaleProvider';
import { localizeCar } from '@/lib/car-translations';
import { carOption, optionId, optionLabel } from '@/lib/vehicle-specs';
import { MediaImage } from './MediaImage';
import type { Car } from '@/lib/cars';
import { formatPrice } from '@/lib/cars';
import { FavoriteButton } from './FavoriteButton';
import { MarketIcon } from './MarketIcon';

export function VehicleCard({ car: originalCar, returnHref = '/catalog', eager = false }: { car: Car; catalog?: boolean; returnHref?: string; eager?: boolean }) {
  const { locale, t } = useLocale(); const car = localizeCar(originalCar, locale);
  const fuel = carOption(originalCar, 'fuelType');
  const shortFuel = [['Gasoline', 'Бензин'], ['Pure electric', 'Электро'], ['Plug-in hybrid', 'Гибрид PHEV'], ['Range extender (EREV)', 'Гибрид EREV'], ['Diesel fuel', 'Дизель']].find(([source]) => optionId('fuelType', source) === fuel);
  const transmission = carOption(originalCar, 'transmission') === optionId('transmission', 'Automatic') ? t('Автомат') : car.transmission;
  const powertrain = [shortFuel ? t(shortFuel[1]) : fuel ? optionLabel('fuelType', fuel, locale) : car.engine, shortFuel?.[0] === 'Pure electric' ? car.drive : transmission || car.drive].filter(Boolean).join(' · ');
  const href = '/catalog/' + encodeURIComponent(car.id) + '?back=' + encodeURIComponent(returnHref);
  return <article className="market-car catalog-page-card">
    <div className="market-car-media"><Link href={href} aria-label={car.brand + ' ' + car.model}><MediaImage source={car.image} alt={car.brand + ' ' + car.model} variant="card" eager={eager} /></Link><span className={'market-status ' + (car.status === 'В наличии' ? 'available' : car.status === 'В пути' ? 'transit' : 'order')}>{t(car.status)}</span><FavoriteButton id={car.id} /></div>
    <div className="market-car-body"><div className="market-car-title"><h2><Link href={href}>{car.brand} {car.model}</Link></h2><strong>${formatPrice(car.price)}</strong></div><p>{car.year}<span>·</span>{car.condition === 'Новый' ? t('Новый') : car.mileage}</p><p className="market-car-specs" title={powertrain}>{powertrain || car.trim || '—'}</p><div className="market-car-bottom"><span><MarketIcon name="pin" />{car.city || t('По запросу')}</span><Link href={href}>{t('Подробнее')} ↗</Link></div></div>
  </article>;
}
