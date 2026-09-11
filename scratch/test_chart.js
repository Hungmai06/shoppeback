function extractYearMonth(val) {
  if (!val) return '';
  const str = String(val).trim();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const matchIso = str.match(/^(\d{4})[\/\-](\d{1,2})/);
  if (matchIso) {
    return `${matchIso[1]}-${String(matchIso[2]).padStart(2, '0')}`;
  }

  // 2. VN format: D/M/YYYY or DD/MM/YYYY
  const matchVn = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (matchVn) {
    return `${matchVn[3]}-${String(matchVn[2]).padStart(2, '0')}`;
  }

  // 3. Excel serial number (e.g. 46275.93922)
  const num = Number(str);
  if (!isNaN(num) && num > 20000 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
  }

  // 4. JS Date fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return '';
}

console.log('ISO:', extractYearMonth('2026-09-10 22:32:00'));
console.log('VN:', extractYearMonth('9/10/2026 22:32'));
console.log('Excel:', extractYearMonth('46275.93922453704'));
