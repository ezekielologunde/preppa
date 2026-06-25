// All monetary values are stored as integers (pence) in the DB and the
// platform currency is GBP (£). These utilities ensure safe integer arithmetic
// and consistent display formatting — never format pence as USD.

// Format pence as a GBP string: 1299 → "£12.99"
export function formatMoney(pence: number): string {
  if (!Number.isFinite(pence)) return '£0.00';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

// Convert a pounds string/number to pence: "12.99" → 1299
export function toPence(pounds: number | string): number {
  const n = typeof pounds === 'string' ? parseFloat(pounds) : pounds;
  if (!Number.isFinite(n)) throw new Error(`Invalid pound amount: ${pounds}`);
  return Math.round(n * 100);
}

// Add pence safely: avoids 0.1 + 0.2 float error by keeping integers
export function addPence(...amounts: number[]): number {
  return amounts.reduce((sum, a) => {
    if (!Number.isInteger(a)) throw new Error(`Expected integer pence, got: ${a}`);
    return sum + a;
  }, 0);
}

// Apply a percentage fee: 1000 pence * 0.15 → 150 pence (rounded)
export function applyFee(pence: number, feeRate: number): number {
  return Math.round(pence * feeRate);
}

// Mask account number: "123456789" → "****6789"
export function maskAccountNumber(account: string | null | undefined): string {
  if (!account) return '****';
  const digits = account.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '****' + digits.slice(-4);
}
