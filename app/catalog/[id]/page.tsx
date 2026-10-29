import { VehicleDetail } from '@/components/VehicleDetail';
import { notFound } from 'next/navigation';
import { getPublicSnapshot } from '@/lib/public-snapshot';
import { getDataMode } from '@/lib/supabase-server';
import { jsonLd, pageMetadata, vehicleSeo, vehicleStructuredData } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };
async function findCar(params: Props['params']) {
  const { id } = await params;
  const { cars } = await getPublicSnapshot();
  const car = cars.find(item => item.id === id);
  if (!car && getDataMode() !== 'local') notFound();
  return car;
}
export async function generateMetadata({ params }: Props) {
  const car = await findCar(params);
  if (!car) return { title: 'Автомобиль — firstseven avto', robots: { index: false, follow: true } };
  const seo = vehicleSeo(car);
  return pageMetadata(seo.path, seo.title, seo.description, car.image || car.gallery?.[0]);
}

export default async function VehiclePage({ params }: Props) {
  const { id } = await params;
  const car = await findCar(params);
  return <>{car && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(vehicleStructuredData(car)) }} />}<VehicleDetail id={id} /></>;
}
