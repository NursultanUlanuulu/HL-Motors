'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { localizeCar } from '@/lib/car-translations';
import { MediaImage } from './MediaImage';
import type { Car } from '@/lib/cars';
import { formatPrice } from '@/lib/cars';

export function VehicleCard({ car: originalCar, catalog = false }: { car: Car; catalog?: boolean }) {
  const { locale, t } = useLocale();
  const car = localizeCar(originalCar, locale);
  if (catalog) return (
    <Link className="catalog-page-card" href={`/catalog/${car.id}`}>
      <div className="catalog-page-image"><MediaImage source={car.image} alt={`${car.brand} ${car.model}`} /><span className={`vehicle-status ${car.status === 'Под заказ' ? 'order' : ''}`}>{t(car.status)}</span><span className="card-arrow">↗</span></div>
      <div className="catalog-page-info"><div><h2>{car.brand} {car.model}</h2><p>{car.trim}</p></div><strong>${formatPrice(car.price)}</strong></div>
      <div className="catalog-page-meta"><span>{car.year}</span><span>{car.mileage}</span><span>{t(car.condition)}</span><span>{car.city}</span></div>
    </Link>
  );

  return (
    <Link className="vehicle-card" href={`/catalog/${car.id}`}>
      <div className="vehicle-image"><MediaImage source={car.image} alt={`${car.brand} ${car.model}`} /><span className={`vehicle-status ${car.status === 'Под заказ' ? 'order' : ''}`}>{t(car.status)}</span></div>
      <div className="vehicle-info"><div className="vehicle-head"><h3>{car.brand} {car.model}</h3><strong className="vehicle-price">${formatPrice(car.price)}</strong></div><p>{car.trim}</p><div className="vehicle-details"><span>{car.year}</span><span>{car.mileage}</span><span>{car.city}</span></div></div>
    </Link>
  );
}
