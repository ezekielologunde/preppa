// One-time, in-memory handoff-PIN handoff between the checkout action and the
// order detail screen. The PIN is an escrow credential, so it must NEVER be put
// in a URL (browser history, server logs, referrer headers on web). It lives
// only in module memory and is consumed exactly once.

const pins = new Map<string, string>();

/** Stash the plaintext PIN for an order, to be consumed once by the detail screen. */
export function stashPin(orderId: string, pin: string): void {
  pins.set(orderId, pin);
}

/** Read and remove the PIN for an order. Returns undefined if already consumed. */
export function consumePin(orderId: string): string | undefined {
  const pin = pins.get(orderId);
  if (pin !== undefined) pins.delete(orderId);
  return pin;
}
