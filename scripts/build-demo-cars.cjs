// Rebuild the local demo fixture from the saved AutoHaina research responses.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync(path.join(root, 'lib/vehicle-dictionaries.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(mod.exports, mod);
const { vehicleOptions, vehicleBrands } = mod.exports;
function option(group, value) {
  const found = vehicleOptions[group].find(item => [item.ru, item.en, item.zh, ...item.sources].some(label => label.toLowerCase() === value.toLowerCase()));
  if (!found) throw new Error(`Unknown ${group}: ${value}`);
  return found.id;
}
const entries = [
  { source: 'gas', model: 'GLC 260 L', zh: 'GLC 260 L', price: 29900, status: 'В наличии', trim: ['4MATIC • 2,0 л турбо', '4MATIC • 2.0L turbo', '4MATIC • 2.0升涡轮增压'] },
  { source: 'ev', model: 'eπ007', zh: 'eπ007', price: 24900, status: 'В пути', trim: ['Электромобиль • задний привод', 'Electric • rear-wheel drive', '纯电动 • 后轮驱动'] },
  { source: 'phev', model: 'Seal 06 DM-i', zh: '海豹06 DM-i', price: 19900, status: 'Под заказ', trim: ['Подключаемый гибрид • 1,5 л', 'Plug-in hybrid • 1.5L', '插电式混合动力 • 1.5升'] },
  { source: 'erev', model: 'M7', zh: 'M7', price: 32900, status: 'В наличии', trim: ['Гибрид с увеличителем хода • 6 мест', 'Range extender • 6 seats', '增程式 • 6座'] },
  { source: 'mpv', model: 'Century', zh: '世纪', price: 54900, status: 'В пути', trim: ['Минивэн • 6 мест', 'MPV • 6 seats', 'MPV • 6座'] },
];
const remarks = {
  ru: 'Демонстрационная карточка для проверки сайта. Цена и статус условные; это не предложение продажи. Характеристики и фотографии взяты из сохранённого примера AutoHaina.',
  en: 'Demo listing for testing this website. The price and availability are illustrative, not a sales offer. Specifications and photos come from a saved AutoHaina example.',
  zh: '本车辆为网站功能测试示例。价格和库存状态仅作演示，不构成销售报价。参数和照片来自已保存的 AutoHaina 示例。',
};
const cars = entries.map((entry, index) => {
  const data = JSON.parse(fs.readFileSync(path.join(root, `output/autohaina/${entry.source}_en.json`), 'utf8')).data;
  const brand = vehicleBrands.find(item => item.id === data.brandId);
  if (!brand) throw new Error(`Missing brand ${data.brandId}`);
  const specs = { mileageKm: Number(data.mileage.replace(/[^\d]/g, '')), powerHp: data.horsepower };
  for (const key of ['fuelType', 'transmission', 'driveType', 'bodyType', 'color', 'seats', 'batteryType', 'flowMode']) {
    if (data.specs[key]) specs[key] = option(key, data.specs[key]);
  }
  // The source identifies this model as DM-i in its title but omits fuelType.
  if (entry.source === 'phev') specs.fuelType = option('fuelType', 'Plug-in hybrid');
  for (const key of ['displacement', 'acceleration', 'fuelConsumption', 'batteryCapacity', 'range', 'officialPrice']) {
    const value = parseFloat(data.specs[key]);
    // Source zero placeholders are unknown, not a battery/range specification.
    if (Number.isFinite(value) && value > 0) specs[key] = value;
  }
  if (data.specs.registrationDate) specs.registrationDate = data.specs.registrationDate;
  const translations = Object.fromEntries(['ru', 'en', 'zh'].map((locale, i) => [locale, {
    model: locale === 'zh' ? entry.zh : entry.model,
    trim: entry.trim[i], city: ['Китай', 'China', '中国'][i],
    title: `${['Демо', 'Demo', '演示'][i]} · ${locale === 'zh' ? brand.zh : brand.name} ${locale === 'zh' ? entry.zh : entry.model}`,
    remark: remarks[locale],
  }]));
  return {
    id: `DEMO-${index + 1}`, carCode: `DEMO-${index + 1}`, brand: brand.name, model: entry.model,
    ...translations.ru, price: entry.price, year: Number(data.year), mileage: `${specs.mileageKm} км`,
    status: entry.status, condition: specs.mileageKm ? 'С пробегом' : 'Новый',
    power: `${data.horsepower} л.с.`, drive: '', image: data.images[0], gallery: data.images.slice(0, 5),
    specs, translations,
  };
});
fs.mkdirSync(path.join(root, 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'fixtures/demo-cars.json'), JSON.stringify(cars, null, 2) + '\n');
console.log(`Saved ${cars.length} demo cars.`);
