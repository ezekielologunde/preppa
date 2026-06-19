// All monetary values are stored as integers (cents) in the DB.
// These utilities ensure safe arithmetic and display formatting.

// Format cents as a USD dollar string: 1299 → "$12.99"
export function formatMoney(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// Convert a dollar string/number to cents: "12.99" → 1299
export function toCents(dollars: number | string): number {
  const n = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) throw new Error(`Invalid dollar amount: ${dollars}`);
  return Math.round(n * 100);
}

// Add cents safely: avoids 0.1 + 0.2 float error by keeping integers
export function addCents(...amounts: number[]): number {
  return amounts.reduce((sum, a) => {
    if (!Number.isInteger(a)) throw new Error(`Expected integer cents, got: ${a}`);
    return sum + a;
  }, 0);
}

// Apply a percentage fee: 1000 cents * 0.15 → 150 cents (rounded)
export function applyFee(cents: number, feeRate: number): number {
  return Math.round(cents * feeRate);
}

// Mask account number: "123456789" → "****6789"
export function maskAccountNumber(account: string | null | undefined): string {
  if (!account) return '****';
  const digits = account.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '****' + digits.slice(-4);
}
