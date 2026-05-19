export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const prev = meta.chartPreviousClose || meta.previousClose;
        return res.status(200).json({
          price: meta.regularMarketPrice,
          changePct: prev
            ? +((( meta.regularMarketPrice - prev) / prev) * 100).toFixed(2)
            : null,
          live: true,
        });
      }
    } catch { /* try next */ }
  }
  return res.status(404).json({ error: 'Price not found' });
}
