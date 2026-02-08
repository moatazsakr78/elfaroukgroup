/**
 * Round a monetary value to 2 decimal places.
 * Avoids floating-point drift (e.g. 100.10 + 200.20 = 300.30000000000004).
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
