function formatToMySQLDateTime(val) {
  if (!val) {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }

  const str = String(val).trim();
  if (!str) {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  // 1. If Excel date serial number (e.g. 46275.93922453704)
  const num = Number(str);
  if (!isNaN(num) && num > 20000 && num < 100000) {
    const dateMs = (num - 25569) * 86400 * 1000;
    const date = new Date(dateMs);
    if (!isNaN(date.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    }
  }

  // 2. Vietnam Shopee Date format: e.g. "9/10/2026 22:32", "09/10/2026 22:32:00", "9/10/2026"
  const vnMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (vnMatch) {
    const day = String(vnMatch[1]).padStart(2, '0');
    const month = String(vnMatch[2]).padStart(2, '0');
    const year = vnMatch[3];
    const hour = vnMatch[4] ? String(vnMatch[4]).padStart(2, '0') : '00';
    const minute = vnMatch[5] ? String(vnMatch[5]).padStart(2, '0') : '00';
    const second = vnMatch[6] ? String(vnMatch[6]).padStart(2, '0') : '00';
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // 3. ISO / Standard SQL datetime format: e.g. "2026-09-10 22:32:00" or "2026-09-10T22:32:00.000Z"
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(isoMatch[2]).padStart(2, '0');
    const day = String(isoMatch[3]).padStart(2, '0');
    const hour = isoMatch[4] ? String(isoMatch[4]).padStart(2, '0') : '00';
    const minute = isoMatch[5] ? String(isoMatch[5]).padStart(2, '0') : '00';
    const second = isoMatch[6] ? String(isoMatch[6]).padStart(2, '0') : '00';
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // 4. Standard JS Date parse fallback
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
  }

  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// Test cases
console.log('Test 1 (Excel Serial Number):', formatToMySQLDateTime('46275.93922453704'));
console.log('Test 2 (VN Date String):', formatToMySQLDateTime('9/10/2026 22:32'));
console.log('Test 3 (ISO String):', formatToMySQLDateTime('2026-09-10T22:32:00.000Z'));
console.log('Test 4 (Empty):', formatToMySQLDateTime(''));
