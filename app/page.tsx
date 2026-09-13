'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HomeCatalog } from '@/components/HomeCatalog';
import { ContactButtons } from '@/components/ContactButtons';

export default function HomePage() {
  const { t } = useLocale();
  return <>
    <Header active="home" />
    <main id="top">
      <section className="hero" aria-labelledby="hero-title"><div className="hero-media" aria-hidden="true"></div><div className="hero-glow" aria-hidden="true"></div><div className="hero-grid" aria-hidden="true"></div><div className="hero-content"><p className="eyebrow">{t("Поставка автомобилей из Китая")} <span></span>  {t("с 2015 года")}</p><h1 id="hero-title">{t("Автомобили,")}<br /><em>{t("достойные")}</em>  {t("движения.")}</h1><p className="hero-lead">{t("Находим, проверяем и доставляем автомобили из Китая. От первого выбора — до ключей в ваших руках.")}</p><div className="hero-ctas"><Link className="button button-gold" href="/catalog">{t("Смотреть автомобили")} <span>↗</span></Link><a className="text-link" href="#process">{t("Узнать о поставке")} <span>↓</span></a></div></div><div className="hero-meta"><div><span>01</span><small>01 / 04</small></div><p>{t("Ваш проводник")}<br />{t("на автомобильном рынке Китая")}</p></div><a className="scroll-cue" href="#catalog" aria-label={t("Прокрутить к каталогу")}><span>SCROLL</span><i></i></a></section>
      <HomeCatalog />
      <section id="about" className="statement section-space"><div className="statement-image"></div><div className="statement-content"><p className="eyebrow"><span className="section-number">03</span> Motors</p><h2>{t("Не просто")}<br />{t("поставляем.")} <em>{t("Отвечаем")}</em><br />{t("за каждый выбор.")}</h2><p>{t("Мы более десяти лет работаем с автомобильным рынком Китая и пять лет — в Кыргызстане. Вы видите реальную историю автомобиля, понимаете состав цены и знаете, где находится машина на каждом этапе.")}</p><div className="figures"><div><strong>10<span>+</span></strong><small>{t("лет опыта")}<br />{t("в Китае")}</small></div><div><strong>1 200<span>+</span></strong><small>{t("автомобилей")}<br />{t("доставлено")}</small></div><div><strong>4</strong><small>{t("страны")}<br />{t("поставки")}</small></div></div><a className="text-link dark-link" href="#contacts">{t("Больше о нас")} <span>↗</span></a></div></section>
      <section id="process" className="process section-space" aria-labelledby="process-title"><div className="section-header"><div><p className="eyebrow"><span className="section-number">04</span>  {t("Полный цикл")}</p><h2 id="process-title">{t("Спокойствие на каждом")}<br /><em>{t("километре пути")}</em></h2></div><p className="process-intro">{t("Вы выбираете автомобиль. Всё остальное берём на себя — от проверки в Китае до выдачи в вашем городе.")}</p></div><ol className="process-list"><li><span>01</span><div><h3>{t("Подбор")}</h3><p>{t("Находим автомобиль по вашим параметрам и бюджету.")}</p></div><i>↗</i></li><li><span>02</span><div><h3>{t("Проверка")}</h3><p>{t("Проводим осмотр, диагностику и проверяем документы.")}</p></div><i>↗</i></li><li><span>03</span><div><h3>{t("Доставка")}</h3><p>{t("Организуем безопасную перевозку и сопровождаем груз.")}</p></div><i>↗</i></li><li><span>04</span><div><h3>{t("Оформление")}</h3><p>{t("Таможня, лаборатория и документы — без лишних забот.")}</p></div><i>↗</i></li></ol></section>
      <section className="testimonial"><div className="quote-mark">“</div><blockquote>{t("В Motors нет сюрпризов после покупки. Только честный автомобиль, прозрачная цена и команда, которой можно доверять.")}</blockquote><div className="testimonial-author"><div className="avatar">{t("А")}</div><div><strong>{t("Алексей М.")}</strong><span>{t("Zeekr 001 · Бишкек")}</span></div></div><div className="testimonial-count">01 <i></i> 03</div></section>
      <section id="contacts" className="contact-cta"><div className="contact-car" aria-hidden="true"></div><div className="contact-inner"><p className="eyebrow">{t("Ваш следующий автомобиль уже ждёт")}</p><h2>{t("Начнём")}<br />{t("с разговора.")}</h2><p>{t("Расскажите, какой автомобиль ищете — найдём лучший вариант и рассчитаем поставку под ключ.")}</p><ContactButtons /></div></section>
    </main>
    <Footer />
  </>;
}
