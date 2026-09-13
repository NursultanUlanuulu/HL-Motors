import { VehicleDetail } from '@/components/VehicleDetail';

export const metadata = { title: 'Автомобиль — Motors' };

// Local records are resolved after hydration, including IDs created in the admin panel.
export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetail id={id} />;
}
