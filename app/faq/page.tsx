import { MarketInfo } from '@/components/MarketInfo';
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata('/faq', 'Вопросы о покупке автомобилей из Китая — firstseven avto', 'Ответы на вопросы о подборе и осмотре автомобиля, договоре, предоплате, доставке из Китая, таможенном оформлении и отмене заказа.');
export default function Page() { return <MarketInfo kind="faq" />; }
