import { MarketInfo } from '@/components/MarketInfo';
import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata('/contacts', 'Контакты firstseven avto — Бишкек, Исакеева 32/2', 'Офис firstseven avto: Бишкек, ул. Исакеева, 32/2. Ежедневно с 11:00 до 19:00. Свяжитесь с менеджерами через WhatsApp, WeChat или Telegram.');
export default function Page() { return <MarketInfo kind="contacts" />; }
