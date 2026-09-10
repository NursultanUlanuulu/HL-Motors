const cars = window.HLCars;

const grid = document.querySelector('#catalog-grid');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const fields = {
  brand: document.querySelector('#brand-filter'),
  status: document.querySelector('#status-filter'),
  price: document.querySelector('#price-filter'),
  year: document.querySelector('#year-filter'),
  condition: document.querySelector('#condition-filter'),
  sort: document.querySelector('#sort-filter')
};

const price = value => new Intl.NumberFormat('en-US').format(value);

function getFilteredCars() {
  const maximum = Number(fields.price.value || Infinity);
  return cars.filter(car =>
    (!fields.brand.value || car.brand === fields.brand.value) &&
    (!fields.status.value || car.status === fields.status.value) &&
    car.price <= maximum &&
    (!fields.year.value || String(car.year) === fields.year.value) &&
    (!fields.condition.value || car.condition === fields.condition.value)
  ).sort((a, b) => fields.sort.value === 'desc' ? b.price - a.price : a.price - b.price);
}

function renderCars() {
  const filtered = getFilteredCars();
  grid.innerHTML = filtered.map(car => `
    <article class="vehicle-card" data-id="${car.id}" tabindex="0" role="button" aria-label="Открыть ${car.brand} ${car.model}">
      <div class="vehicle-image"><img src="${car.image}" alt="${car.brand} ${car.model}" loading="lazy" /><span class="vehicle-status ${car.status === 'Под заказ' ? 'order' : ''}">${car.status}</span></div>
      <div class="vehicle-info"><div class="vehicle-head"><h3>${car.brand} ${car.model}</h3><strong class="vehicle-price">$${price(car.price)}</strong></div><p>${car.trim}</p><div class="vehicle-details"><span>${car.year}</span><span>${car.mileage}</span><span>${car.city}</span></div></div>
    </article>`).join('');
  resultCount.textContent = `${String(filtered.length).padStart(2, '0')} ${pluralize(filtered.length, ['автомобиль', 'автомобиля', 'автомобилей'])}`;
  emptyState.hidden = filtered.length !== 0;
}

function pluralize(value, words) {
  const n = Math.abs(value) % 100; const n1 = n % 10;
  if (n > 10 && n < 20) return words[2];
  if (n1 > 1 && n1 < 5) return words[1];
  if (n1 === 1) return words[0];
  return words[2];
}

Object.values(fields).forEach(field => field.addEventListener('change', renderCars));
document.querySelector('#quick-search-form').addEventListener('submit', event => { event.preventDefault(); renderCars(); document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' }); });

const filterPanel = document.querySelector('#filter-panel');
document.querySelector('#filter-button').addEventListener('click', event => {
  const open = filterPanel.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', open);
});
document.querySelector('#reset-filters').addEventListener('click', () => { Object.values(fields).forEach(field => field.value = field.id === 'sort-filter' ? 'asc' : ''); renderCars(); });

const modal = document.querySelector('#vehicle-modal');
function showModal(id) {
  const car = cars.find(item => item.id === id); if (!car) return;
  document.querySelector('#modal-image').style.backgroundImage = `url('${car.image}')`;
  document.querySelector('#modal-status').textContent = `${car.status} · ${car.id}`;
  document.querySelector('#modal-title').textContent = `${car.brand} ${car.model}`;
  document.querySelector('#modal-specs').textContent = `${car.trim} · ${car.condition.toLowerCase()}`;
  document.querySelector('#modal-price').textContent = `$${price(car.price)}`;
  document.querySelector('#modal-details').innerHTML = `<dt>Год выпуска</dt><dd>${car.year}</dd><dt>Пробег</dt><dd>${car.mileage}</dd><dt>Мощность</dt><dd>${car.power}</dd><dt>Привод</dt><dd>${car.drive}</dd><dt>Местонахождение</dt><dd>${car.city}</dd>`;
  document.querySelector('#modal-contact').href = `https://wa.me/996502102270?text=${encodeURIComponent(`Здравствуйте! Интересует ${car.brand} ${car.model} (${car.id}), ${car.year}, $${price(car.price)}. Статус: ${car.status}.`)}`;
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
grid.addEventListener('click', event => { const card = event.target.closest('.vehicle-card'); if (card) window.location.href = `vehicle.html?id=${card.dataset.id}`; });
grid.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.vehicle-card')) { event.preventDefault(); window.location.href = `vehicle.html?id=${event.target.closest('.vehicle-card').dataset.id}`; } });
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

const themeToggle = document.querySelector('.theme-toggle');
if (localStorage.getItem('hl-theme') === 'light') document.body.classList.add('light');
themeToggle.addEventListener('click', () => { document.body.classList.toggle('light'); localStorage.setItem('hl-theme', document.body.classList.contains('light') ? 'light' : 'dark'); });
const langToggle = document.querySelector('.lang-toggle'); const menu = document.querySelector('.language-menu');
langToggle.addEventListener('click', () => { const open = menu.classList.toggle('open'); langToggle.setAttribute('aria-expanded', open); });
menu.addEventListener('click', event => { if (!event.target.matches('button')) return; menu.querySelector('.active').classList.remove('active'); event.target.classList.add('active'); langToggle.childNodes[0].nodeValue = `${event.target.dataset.lang} `; menu.classList.remove('open'); });

const toast = document.querySelector('#toast');
const copyMessageButton = document.querySelector('#copy-message');
if (copyMessageButton) copyMessageButton.addEventListener('click', async () => { try { await navigator.clipboard.writeText('Здравствуйте! Ищу автомобиль из Китая. Хочу получить консультацию по подбору и поставке.'); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); } catch { /* Clipboard can be unavailable in a local preview. */ } });
document.querySelector('.scroll-cue').addEventListener('click', event => document.querySelector(event.currentTarget.dataset.scroll).scrollIntoView({ behavior: 'smooth' }));
renderCars();
