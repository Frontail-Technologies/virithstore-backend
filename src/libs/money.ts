/** Virith Points are pegged to the dollar: 100 points = $1.00. */
export const POINTS_PER_USD = 100;

export const toPoints = (usd: number) => Math.round(usd * POINTS_PER_USD);

/** numeric columns arrive as strings; amounts are formatted back to two decimals for storage. */
export const parseMoney = (value: string | number | null | undefined) => parseFloat(String(value ?? 0)) || 0;
export const formatMoney = (value: number) => value.toFixed(2);
