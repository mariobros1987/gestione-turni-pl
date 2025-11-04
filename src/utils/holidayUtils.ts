/**
 * Utility per la gestione delle festività italiane
 */

/**
 * Verifica se una data è una festività (nazionale o patronale)
 */
export const isFestivo = (date: Date): { isHoliday: boolean; isPatronale: boolean } => {
  const day = date.getDay();
  const y = date.getFullYear();
  
  // Festività fisse
  const festeFisse = [
    `01-01`, // Capodanno
    `06-01`, // Epifania
    `25-04`, // Liberazione
    `01-05`, // Lavoro
    `02-06`, // Repubblica
    `15-08`, // Ferragosto
    `01-11`, // Ognissanti
    `08-12`, // Immacolata
    `25-12`, // Natale
    `26-12`, // Santo Stefano
  ];

  // Festa patronale
  const festaPatronale = `05-05`; // 5 maggio

  // Algoritmo di Meeus per calcolare la Pasqua
  function getPasqua(year: number) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  const pasqua = getPasqua(y);
  const pasquetta = new Date(pasqua);
  pasquetta.setDate(pasqua.getDate() + 1);

  // Formatta la data come MM-DD usando UTC per evitare problemi di timezone
  const mmdd = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  const isFestaFissa = festeFisse.includes(mmdd);
  const isPatronale = mmdd === festaPatronale;
  const isPasqua = date.getUTCDate() === pasqua.getDate() && date.getUTCMonth() === pasqua.getMonth();
  const isPasquetta = date.getUTCDate() === pasquetta.getDate() && date.getUTCMonth() === pasquetta.getMonth();

  const isHoliday = day === 0 || isFestaFissa || isPasqua || isPasquetta || isPatronale;

  return { isHoliday, isPatronale };
};
