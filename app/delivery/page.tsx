import { MarketInfo } from '@/components/MarketInfo';
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata('/delivery', 'Доставка и оплата автомобилей из Китая — firstseven avto', 'Доставка автомобилей из Китая от 14 дней. Договор, предоплата 50–80%, остаток при получении. Доставка, оформление и таможенные платежи для авто под заказ рассчитываются отдельно.');
export default function Page() { return <MarketInfo kind="delivery" />; }
