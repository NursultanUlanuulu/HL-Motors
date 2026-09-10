const params = new URLSearchParams(window.location.search);
const detailCar = window.HLCars.find(car => car.id === params.get('id')) || window.HLCars[0];
const detailPrice = value => new Intl.NumberFormat('en-US').format(value);
const detailGallery = detailCar.gallery || [detailCar.image, ...window.HLCars.slice(1).map(car => car.image), detailCar.image, detailCar.image, detailCar.image, detailCar.image];
document.title = `${detailCar.brand} ${detailCar.model} — HL Motors`;
const message = encodeURIComponent(`Здравствуйте! Интересует ${detailCar.brand} ${detailCar.model}. Номер объявления: ${detailCar.id}. Год: ${detailCar.year}. Цена: $${detailPrice(detailCar.price)}. Статус: ${detailCar.status}.`);
const whatsappUrl = `https://wa.me/996502102270?text=${message}`;
document.querySelector('#vehicle-page').innerHTML = `
  <section class="vehicle-top">
    <div class="breadcrumbs"><a href="index.html">Главная</a><span>·</span><a href="catalog.html">Автомобили</a><span>·</span><b>${detailCar.brand} ${detailCar.model}</b></div>
    <div class="vehicle-heading"><div><p class="eyebrow"><span class="status-dot"></span>${detailCar.status} <span class="vehicle-id">${detailCar.id}</span></p><h1>${detailCar.brand} <em>${detailCar.model}</em></h1><p>${detailCar.trim} · ${detailCar.condition.toLowerCase()}</p></div><a class="back-link" href="catalog.html">← Все автомобили</a></div>
  </section>
  <section class="vehicle-showcase">
    <div class="main-gallery-image" id="main-gallery-image" style="background-image:url('${detailGallery[0]}')"><span class="gallery-counter" id="gallery-counter">1 / ${detailGallery.length}</span><button class="gallery-next" id="gallery-next" aria-label="Следующее фото">→</button></div>
    <div class="gallery-strip" id="gallery-strip">${detailGallery.map((image, index) => `<button class="gallery-thumb ${index === 0 ? 'active' : ''}" data-index="${index}" style="background-image:url('${image}')" aria-label="Фото ${index + 1}"></button>`).join('')}<button class="gallery-video-thumb" id="open-video" style="background-image:linear-gradient(#0007,#0007),url('${detailGallery[4]}')"><span class="play-icon">▶</span><b>Видео<br />обзор</b></button></div>
  </section>
  <section class="vehicle-detail-layout">
    <div class="vehicle-information">
      <div class="detail-intro"><p class="eyebrow"><span class="section-number">01</span> Об автомобиле</p><h2>Всё, что важно<br />знать <em>до покупки.</em></h2><p>Автомобиль прошёл визуальный осмотр и первичную техническую проверку. Полный фото- и видеоотчёт по запросу менеджеру.</p></div>
      <div class="spec-section"><h3>Основные характеристики</h3><dl class="spec-grid"><dt>Год выпуска</dt><dd>${detailCar.year}</dd><dt>Пробег</dt><dd>${detailCar.mileage}</dd><dt>Состояние</dt><dd>${detailCar.condition}</dd><dt>Тип кузова</dt><dd>${detailCar.body || 'Кроссовер'}</dd><dt>Двигатель</dt><dd>Электро / гибрид</dd><dt>Мощность</dt><dd>${detailCar.power}</dd><dt>Коробка передач</dt><dd>${detailCar.transmission || 'Автоматическая'}</dd><dt>Привод</dt><dd>${detailCar.drive}</dd><dt>Цвет кузова</dt><dd>${detailCar.color || 'Чёрный металлик'}</dd><dt>VIN</dt><dd>${detailCar.vin || 'По запросу'}</dd></dl></div>
      <div class="customs-block"><span>✦</span><div><h3>Таможенная информация</h3><p>Статус и состав цены зависят от страны доставки. Менеджер подготовит расчёт под ключ с учётом таможенного оформления, лаборатории и регистрации.</p></div><a href="${whatsappUrl}" target="_blank" rel="noreferrer">Уточнить условия ↗</a></div>
      <div class="location-block"><p class="eyebrow"><span class="section-number">02</span> Местонахождение</p><h3>${detailCar.city}</h3><p>Текущий статус: <b>${detailCar.status}</b>. Получите актуальные фото, видео и информацию о сроках поставки у менеджера.</p></div>
    </div>
    <aside class="purchase-card"><div class="purchase-price"><span>Стоимость</span><strong>$${detailPrice(detailCar.price)}</strong><small>Ориентировочная цена в USD</small></div><div class="purchase-status"><span class="status-dot"></span><div><b>${detailCar.status}</b><small>${detailCar.city}</small></div></div><a class="button button-gold" href="${whatsappUrl}" target="_blank" rel="noreferrer">Написать в WhatsApp <span>↗</span></a><a class="purchase-telegram" href="https://t.me/nur6ultan" target="_blank" rel="noreferrer">Telegram @nur6ultan <span>↗</span></a><p>Свяжитесь с менеджером — он отправит подробный отчёт, ответит на вопросы и зафиксирует условия.</p></aside>
  </section>
  <section class="detail-contact"><p class="eyebrow">HL Motors · полная прозрачность</p><h2>Остались вопросы<br />по <em>автомобилю?</em></h2><a class="text-link" href="${whatsappUrl}" target="_blank" rel="noreferrer">Получить консультацию <span>↗</span></a></section>
  <div class="mobile-contact"><span>$${detailPrice(detailCar.price)}</span><a class="button button-gold" href="${whatsappUrl}" target="_blank" rel="noreferrer">Написать <span>↗</span></a></div>`;
const currentImage = document.querySelector('#main-gallery-image');
const counter = document.querySelector('#gallery-counter');
let selectedImage = 0;
function selectImage(index) { selectedImage = (index + detailGallery.length) % detailGallery.length; currentImage.style.backgroundImage = `url('${detailGallery[selectedImage]}')`; counter.textContent = `${selectedImage + 1} / ${detailGallery.length}`; document.querySelectorAll('.gallery-thumb').forEach((thumb, thumbIndex) => thumb.classList.toggle('active', thumbIndex === selectedImage)); }
document.querySelector('#gallery-strip').addEventListener('click', event => { const thumb = event.target.closest('.gallery-thumb'); if (thumb) selectImage(Number(thumb.dataset.index)); });
document.querySelector('#gallery-next').addEventListener('click', () => selectImage(selectedImage + 1));
const videoModal = document.querySelector('#video-modal'); const video = document.querySelector('#vehicle-video');
document.querySelector('#open-video').addEventListener('click', () => { video.poster = detailGallery[4]; video.src = 'https://videos.pexels.com/video-files/4441006/4441006-hd_1920_1080_25fps.mp4'; videoModal.classList.add('open'); videoModal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; });
function closeVideo() { video.pause(); videoModal.classList.remove('open'); videoModal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
document.querySelectorAll('[data-close-video]').forEach(button => button.addEventListener('click', closeVideo)); document.addEventListener('keydown', event => { if (event.key === 'Escape') closeVideo(); });
const detailTheme = document.querySelector('.theme-toggle'); if (localStorage.getItem('hl-theme') === 'light') document.body.classList.add('light'); detailTheme.addEventListener('click', () => { document.body.classList.toggle('light'); localStorage.setItem('hl-theme', document.body.classList.contains('light') ? 'light' : 'dark'); });
