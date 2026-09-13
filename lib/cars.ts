export type CarStatus = 'В наличии' | 'В пути' | 'Под заказ';
export type CarCondition = 'Новый' | 'С пробегом';
export const customsTypes = ['ТПО', 'ГТД'] as const;
export type CustomsType = typeof customsTypes[number];
export const carTextFields = ['brand', 'model', 'trim', 'mileage', 'city', 'power', 'drive', 'body', 'color', 'transmission', 'engine'] as const;
export type CarTextField = typeof carTextFields[number];
export type CarText = Partial<Record<CarTextField, string>>;

export type Car = {
  id: string;
  brand: string;
  model: string;
  trim: string;
  price: number;
  year: number;
  mileage: string;
  status: CarStatus;
  condition: CarCondition;
  city: string;
  power: string;
  drive: string;
  image: string;
  color?: string;
  body?: string;
  transmission?: string;
  engine?: string;
  vin?: string;
  customsType?: CustomsType;
  translations?: { ru?: CarText; zh?: CarText };
  gallery?: string[];
  video?: string;
};

export const cars: Car[] = [
  { id: 'HL-24018', brand: 'Zeekr', model: '001', trim: 'YOU 100 kWh AWD', price: 58900, year: 2024, mileage: '6 800 км', status: 'В наличии', condition: 'С пробегом', city: 'Бишкек', power: '544 л.с.', drive: 'Полный', color: 'Graphite Grey', body: 'Лифтбек', transmission: 'Одноступенчатая', vin: 'LFZKJ4C52R3001842', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85', gallery: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=90','https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=85','https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1100&q=75&sat=-30','https://images.unsplash.com/photo-1485463611174-f302f6a5c1e4?auto=format&fit=crop&w=1000&q=85'] },
  { id: 'HL-25002', brand: 'Li Auto', model: 'L9', trim: 'Ultra 52.3 kWh', price: 71600, year: 2025, mileage: 'Новый', status: 'В пути', condition: 'Новый', city: 'Китай, Гуанчжоу', power: '449 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-24041', brand: 'Toyota', model: 'Land Cruiser 300', trim: 'ZX 3.5 AT', price: 102900, year: 2024, mileage: '12 400 км', status: 'В наличии', condition: 'С пробегом', city: 'Москва', power: '415 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-25009', brand: 'BYD', model: 'Yangwang U8', trim: 'Premium Edition', price: 118500, year: 2025, mileage: 'Новый', status: 'Под заказ', condition: 'Новый', city: 'Китай, Шэньчжэнь', power: '1 197 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-24032', brand: 'Mercedes-Benz', model: 'S 580', trim: '4MATIC Long', price: 98500, year: 2024, mileage: '9 200 км', status: 'В наличии', condition: 'С пробегом', city: 'Алматы', power: '503 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-24056', brand: 'Zeekr', model: '009', trim: 'WE 140 kWh', price: 76500, year: 2024, mileage: '3 100 км', status: 'В пути', condition: 'С пробегом', city: 'Китай, Нинбо', power: '544 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1514316454349-750a7fd3da3a?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-25011', brand: 'Toyota', model: 'Alphard', trim: 'Executive Lounge', price: 86700, year: 2025, mileage: 'Новый', status: 'Под заказ', condition: 'Новый', city: 'Китай, Тяньцзинь', power: '190 л.с.', drive: 'Передний', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-23081', brand: 'Li Auto', model: 'L7', trim: 'Max', price: 52500, year: 2023, mileage: '20 900 км', status: 'В наличии', condition: 'С пробегом', city: 'Бишкек', power: '449 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-25014', brand: 'Aito', model: 'M9', trim: 'Max 52 kWh', price: 82400, year: 2025, mileage: 'Новый', status: 'В пути', condition: 'Новый', city: 'Китай, Шанхай', power: '496 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-24067', brand: 'Porsche', model: 'Cayenne', trim: 'E-Hybrid', price: 108900, year: 2024, mileage: '8 000 км', status: 'В наличии', condition: 'С пробегом', city: 'Минск', power: '470 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=85&sat=-30' },
  { id: 'HL-25018', brand: 'Lexus', model: 'GX 550', trim: 'Overtrail+', price: 113000, year: 2025, mileage: 'Новый', status: 'Под заказ', condition: 'Новый', city: 'Китай, Далянь', power: '354 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&w=1200&q=85' },
  { id: 'HL-24091', brand: 'BMW', model: 'i7', trim: 'xDrive60', price: 99500, year: 2024, mileage: '14 300 км', status: 'В пути', condition: 'С пробегом', city: 'Китай, Пекин', power: '544 л.с.', drive: 'Полный', image: 'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=1200&q=85' }
];

export const getCar = (id: string) => cars.find((car) => car.id === id);
export const formatPrice = (value: number) => new Intl.NumberFormat('en-US').format(value);

export function pluralizeCars(value: number) {
  const last = Math.abs(value) % 10;
  const hundred = Math.abs(value) % 100;
  if (hundred > 10 && hundred < 20) return 'автомобилей';
  if (last === 1) return 'автомобиль';
  if (last > 1 && last < 5) return 'автомобиля';
  return 'автомобилей';
}
