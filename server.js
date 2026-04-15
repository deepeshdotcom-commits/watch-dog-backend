const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// --- CACHE SYSTEM ---
let priceCache = { data: null, lastFetched: 0 };
const CACHE_DURATION = 60 * 1000; // 1 minute cache for live prices

// --- HELPER: MOCK HISTORY GENERATOR ---
// Note: Real historical data often requires a subscription or a specific scraper.
// This function provides mathematically sound price drift for the terminal UI.
const generateHistory = (symbol, range, currentPrice) => {
  const points = {
    '1D': 20, '1W': 30, '1M': 30, '3M': 45, '6M': 60, '1Y': 100
  }[range] || 20;

  const data = [];
  let lastPrice = currentPrice || 500;
  
  for (let i = points; i >= 0; i--) {
    const change = (Math.random() - 0.5) * (lastPrice * 0.02);
    lastPrice = lastPrice - change;
    data.push({
      time: i === 0 ? "Now" : `${i} periods ago`,
      price: parseFloat(lastPrice.toFixed(2))
    });
  }
  return data.reverse();
};

// --- ENDPOINT: LIVE PRICES ---
app.get('/api/live-prices', async (req, res) => {
  const now = Date.now();
  if (priceCache.data && (now - priceCache.lastFetched < CACHE_DURATION)) {
    return res.json(priceCache.data);
  }

  try {
    const { data: html } = await axios.get('https://merolagani.com/LatestMarket.aspx', { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(html);
    const stocks = [];

    $('#ctl00_ContentPlaceHolder1_dgLiveMarket tr').each((i, row) => {
      if (i === 0) return; 
      const cols = $(row).find('td');
      if (cols.length < 8) return;

      stocks.push({
        symbol: $(cols[0]).text().trim(),
        price: parseFloat($(cols[1]).text().replace(/,/g, '')),
        prev: parseFloat($(cols[7]).text().replace(/,/g, '')),
        high: parseFloat($(cols[4]).text().replace(/,/g, '')),
        low: parseFloat($(cols[5]).text().replace(/,/g, '')),
        volume: parseFloat($(cols[6]).text().replace(/,/g, ''))
      });
    });

    if (stocks.length > 0) {
      priceCache = { data: stocks, lastFetched: now };
      res.json(stocks);
    } else {
      throw new Error("Empty payload from source");
    }
  } catch (error) {
    console.error("Scraper Error:", error.message);
    // If cache exists, return it even if expired to prevent UI breakage
    if (priceCache.data) return res.json(priceCache.data);
    res.status(500).json({ error: "Terminal data feed interrupted" });
  }
});

// --- ENDPOINT: HISTORICAL DATA (REQUIRED FOR CHARTS) ---
app.get('/api/history', (req, res) => {
  const { symbol, range } = req.query;
  
  if (!symbol) {
    return res.status(400).json({ error: "Symbol required" });
  }

  // Find the current price from cache to anchor the history drift
  const currentStock = priceCache.data ? priceCache.data.find(s => s.symbol === symbol) : null;
  const currentPrice = currentStock ? currentStock.price : 500;

  const history = generateHistory(symbol, range || '1D', currentPrice);
  res.json(history);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Watch Dog Terminal Backend active on port ${PORT}`));
