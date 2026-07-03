import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  getLocalDateString,
  getStartOfWeek,
  aggregateByDate,
  formatTotals,
  validateExpenseInput,
  validateVoucherFile,
  voucherPathFromUrl,
  toCsv,
  isValidVoucherUrl
} from '../js/utils.js';

const CURRENCIES = {
  USD: { label: 'Dólares', symbol: '$' },
  PEN: { label: 'Soles', symbol: 'S/' }
};

describe('escapeHtml', () => {
  it('escapa caracteres peligrosos', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
  });

  it('maneja null/undefined sin lanzar', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('getLocalDateString / getStartOfWeek', () => {
  it('formatea como AAAA-MM-DD en hora local', () => {
    // 15 de junio de 2026 (lunes), mediodía local para evitar bordes de zona horaria
    const d = new Date(2026, 5, 15, 12, 0, 0);
    expect(getLocalDateString(d)).toBe('2026-06-15');
  });

  it('startOfWeek devuelve el domingo previo', () => {
    // 2026-06-17 es miércoles; el domingo de esa semana es 2026-06-14
    const wed = new Date(2026, 5, 17, 12, 0, 0);
    expect(getStartOfWeek(wed)).toBe('2026-06-14');
  });

  it('startOfWeek en domingo devuelve el mismo día', () => {
    const sun = new Date(2026, 5, 14, 12, 0, 0);
    expect(getStartOfWeek(sun)).toBe('2026-06-14');
  });
});

describe('aggregateByDate', () => {
  const expenses = [
    { date: '2026-06-10', amount: '10.00', currency: 'USD' },
    { date: '2026-06-10', amount: '5.50', currency: 'USD' },
    { date: '2026-06-11', amount: '20', currency: 'PEN' },
    { date: '2026-05-30', amount: '99', currency: 'USD' }, // fuera del mes
    { date: '2026-06-12', amount: '7', currency: 'XYZ' } // moneda inválida → USD
  ];

  it('separa por moneda y suma por fecha', () => {
    const res = aggregateByDate(expenses, CURRENCIES);
    expect(res.USD['2026-06-10']).toBe(15.5);
    expect(res.PEN['2026-06-11']).toBe(20);
    expect(res.USD['2026-06-12']).toBe(7); // moneda inválida cae a USD
  });

  it('filtra por prefijo de mes', () => {
    const res = aggregateByDate(expenses, CURRENCIES, '2026-06');
    expect(res.USD['2026-05-30']).toBeUndefined();
    expect(res.USD['2026-06-10']).toBe(15.5);
  });

  it('devuelve objetos vacíos para entrada vacía', () => {
    const res = aggregateByDate([], CURRENCIES);
    expect(res).toEqual({ USD: {}, PEN: {} });
  });
});

describe('formatTotals', () => {
  it('muestra sólo monedas con monto', () => {
    expect(formatTotals({ USD: 12.5, PEN: 0 }, CURRENCIES)).toBe('$12.50');
    expect(formatTotals({ USD: 12.5, PEN: 30 }, CURRENCIES)).toBe('$12.50  ·  S/30.00');
  });

  it('devuelve $0.00 cuando no hay montos', () => {
    expect(formatTotals({ USD: 0, PEN: 0 }, CURRENCIES)).toBe('$0.00');
  });
});

describe('validateExpenseInput', () => {
  it('acepta entrada válida', () => {
    expect(validateExpenseInput({ concept: 'Café', amount: 4.5 }).valid).toBe(true);
  });

  it('rechaza concepto vacío', () => {
    expect(validateExpenseInput({ concept: '   ', amount: 5 }).valid).toBe(false);
  });

  it('rechaza monto no positivo', () => {
    expect(validateExpenseInput({ concept: 'x', amount: 0 }).valid).toBe(false);
    expect(validateExpenseInput({ concept: 'x', amount: -3 }).valid).toBe(false);
    expect(validateExpenseInput({ concept: 'x', amount: NaN }).valid).toBe(false);
  });

  it('rechaza monto sobre el techo', () => {
    expect(validateExpenseInput({ concept: 'x', amount: 2_000_000 }).valid).toBe(false);
  });
});

describe('toCsv', () => {
  const cols = [
    { key: 'date', label: 'Fecha' },
    { key: 'concept', label: 'Concepto' },
    { key: 'amount', label: 'Monto' }
  ];

  it('genera encabezado y filas separadas por CRLF', () => {
    const csv = toCsv([{ date: '2026-07-01', concept: 'Café', amount: 4.5 }], cols);
    expect(csv).toBe('Fecha,Concepto,Monto\r\n2026-07-01,Café,4.5');
  });

  it('escapa comas, comillas y saltos de línea', () => {
    const csv = toCsv(
      [{ date: '2026-07-01', concept: 'Almuerzo, con "socio"\nlínea 2', amount: 10 }],
      cols
    );
    expect(csv.split('\r\n')[1]).toBe('2026-07-01,"Almuerzo, con ""socio""\nlínea 2",10');
  });

  it('maneja valores nulos y filas vacías', () => {
    expect(toCsv([{ date: null, concept: undefined, amount: 0 }], cols)).toBe(
      'Fecha,Concepto,Monto\r\n,,0'
    );
    expect(toCsv([], cols)).toBe('Fecha,Concepto,Monto');
    expect(toCsv(null, cols)).toBe('Fecha,Concepto,Monto');
  });
});

describe('validateVoucherFile', () => {
  const file = (type, size) => ({ type, size, name: 'x' });

  it('acepta imágenes rasterizadas dentro del límite', () => {
    expect(validateVoucherFile(file('image/png', 1024)).valid).toBe(true);
    expect(validateVoucherFile(file('image/jpeg', 4 * 1024 * 1024)).valid).toBe(true);
    expect(validateVoucherFile(file('image/webp', 1)).valid).toBe(true);
  });

  it('rechaza tipos peligrosos o no soportados', () => {
    expect(validateVoucherFile(file('image/svg+xml', 10)).valid).toBe(false);
    expect(validateVoucherFile(file('text/html', 10)).valid).toBe(false);
    expect(validateVoucherFile(file('application/pdf', 10)).valid).toBe(false);
    expect(validateVoucherFile(file('', 10)).valid).toBe(false);
  });

  it('rechaza archivos de más de 5MB y entrada nula', () => {
    expect(validateVoucherFile(file('image/png', 5 * 1024 * 1024 + 1)).valid).toBe(false);
    expect(validateVoucherFile(null).valid).toBe(false);
  });
});

describe('voucherPathFromUrl', () => {
  const supa = 'https://lkndwsolpimmezdshgpx.supabase.co';

  it('deriva el path desde una URL pública histórica', () => {
    expect(
      voucherPathFromUrl(`${supa}/storage/v1/object/public/vouchers/uid123/foto.png`)
    ).toBe('uid123/foto.png');
  });

  it('deriva el path desde una URL firmada', () => {
    expect(
      voucherPathFromUrl(`${supa}/storage/v1/object/sign/vouchers/uid123/foto.png?token=abc`)
    ).toBe('uid123/foto.png');
  });

  it('acepta un path directo guardado sin URL', () => {
    expect(voucherPathFromUrl('uid123/foto.png')).toBe('uid123/foto.png');
    expect(voucherPathFromUrl('vouchers/uid123/foto.png')).toBe('uid123/foto.png');
  });

  it('devuelve null para valores inválidos u otros buckets', () => {
    expect(voucherPathFromUrl(null)).toBe(null);
    expect(voucherPathFromUrl('')).toBe(null);
    expect(voucherPathFromUrl(`${supa}/storage/v1/object/public/otro/uid/x.png`)).toBe(null);
    expect(voucherPathFromUrl('https://evil.com/x.png')).toBe(null);
  });
});

describe('isValidVoucherUrl', () => {
  const supa = 'https://lkndwsolpimmezdshgpx.supabase.co';

  it('acepta URLs https del dominio de Supabase', () => {
    expect(
      isValidVoucherUrl(`${supa}/storage/v1/object/public/vouchers/u/x.png`, supa)
    ).toBe(true);
  });

  it('rechaza otros dominios y esquemas', () => {
    expect(isValidVoucherUrl('https://evil.com/x.png', supa)).toBe(false);
    expect(isValidVoucherUrl('javascript:alert(1)', supa)).toBe(false);
    expect(isValidVoucherUrl('', supa)).toBe(false);
    expect(isValidVoucherUrl(null, supa)).toBe(false);
  });
});
