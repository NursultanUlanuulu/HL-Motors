const catalogCars = window.HLCars;
const catalogFields = {
  brand: document.querySelector('#catalog-brand'), status: document.querySelector('#catalog-status'), price: document.querySelector('#catalog-price'), year: document.querySelector('#catalog-year'), condition: document.querySelector('#catalog-condition'), sort: document.querySelector('#catalog-sort')
};
const catalogGrid = document.querySelector('#catalog-page-grid');
const catalogCount = document.querySelector('#catalog-page-count');
const catalogEmpty = document.querySelector('#catalog-empty');
const formatPrice = value => new Intl.NumberFormat('en-US').format(value);
function listCars() {
  const limit = Number(catalogFields.price.value || Infinity);
  return catalogCars.filter(car => (!catalogFields.brand.value || car.brand === catalogFields.brand.value) && (!catalogFields.status.value || car.status === catalogFields.status.value) && (!catalogFields.year.value || String(car.year) === catalogFields.year.value) && (!catalogFields.condition.value || car.condition === catalogFields.condition.value) && car.price <= limit).sort((a, b) => catalogFields.sort.value === 'desc' ? b.price - a.price : a.price - b.price);
}
function renderCatalog() {
  const visible = listCars();
  catalogGrid.innerHTML = visible.map(car => `<a class="catalog-page-card" href="vehicle.html?id=${car.id}"><div class="catalog-page-image"><img src="${car.image}" alt="${car.brand} ${car.model}" loading="lazy"/><span class="vehicle-status ${car.status === 'Под заказ' ? 'order' : ''}">${car.status}</span><span class="card-arrow">↗</span></div><div class="catalog-page-info"><div><h2>${car.brand} ${car.model}</h2><p>${car.trim}</p></div><strong>$${formatPrice(car.price)}</strong></div><div class="catalog-page-meta"><span>${car.year}</span><span>${car.mileage}</span><span>${car.condition}</span><span>${car.city}</span></div></a>`).join('');
  catalogCount.textContent = `${visible.length} ${plural(visible.length)}`; catalogEmpty.hidden = Boolean(visible.length);
}
function plural(value) { return value === 1 ? 'автомобиль' : value > 1 && value < 5 ? 'автомобиля' : 'автомобилей'; }
Object.values(catalogFields).forEach(field => field.addEventListener('change', renderCatalog));
document.querySelector('#catalog-reset').addEventListener('click', () => { Object.values(catalogFields).forEach(field => field.value = field === catalogFields.sort ? 'asc' : ''); renderCatalog(); });
const sidebar = document.querySelector('#catalog-sidebar');
document.querySelector('#catalog-filter-toggle').addEventListener('click', event => { sidebar.classList.toggle('closed'); const isOpen = !sidebar.classList.contains('closed'); event.currentTarget.setAttribute('aria-expanded', isOpen); event.currentTarget.querySelector('b').textContent = isOpen ? '−' : '+'; });
const pageTheme = document.querySelector('.theme-toggle');
if (localStorage.getItem('hl-theme') === 'light') document.body.classList.add('light');
pageTheme.addEventListener('click', () => { document.body.classList.toggle('light'); localStorage.setItem('hl-theme', document.body.classList.contains('light') ? 'light' : 'dark'); });
renderCatalog();
