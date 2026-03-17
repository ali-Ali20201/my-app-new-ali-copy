export const convertPrice = (price: number, productCurrency: string, targetCurrency: string, sypRate: number, tryRate: number) => {
  const fromMap: Record<string, string> = { '$': '$', 'SYP': 'SYR', 'TRY': 'TRY', 'ل.س': 'SYR', 'ل.ت': 'TRY', 'SYR': 'SYR' };
  const toMap: Record<string, string> = { '$': '$', 'SYP': 'SYR', 'TRY': 'TRY', 'ل.س': 'SYR', 'ل.ت': 'TRY', 'SYR': 'SYR' };
  
  const from = fromMap[productCurrency] || productCurrency;
  const to = toMap[targetCurrency] || targetCurrency;

  if (from === to) return price;
  
  let priceInUsd = price;
  if (from === 'SYR') priceInUsd = price / sypRate;
  else if (from === 'TRY') priceInUsd = price / tryRate;
  
  let result = priceInUsd;
  if (to === 'SYR') result = priceInUsd * sypRate;
  else if (to === 'TRY') result = priceInUsd * tryRate;
  
  return Math.round(result * 100) / 100;
};
