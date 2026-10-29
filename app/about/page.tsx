import { MarketInfo } from '@/components/MarketInfo';
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata('/about', 'О компании firstseven avto — автомобили из Китая', 'Работаем с 2021 года. Более 10 лет опыта на рынке Китая, команды в Китае и Кыргызстане. Подбор, проверка и отправка автомобилей по всему миру.');
export default function Page() { return <MarketInfo kind="about" />; }
