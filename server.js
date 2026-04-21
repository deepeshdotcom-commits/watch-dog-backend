const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// --- CACHE SYSTEM ---
let priceCache = { data: null, lastFetched: 0 };
const CACHE_DURATION = 30 * 1000; // Refresh every 30 seconds

/**
 * Generates simulated history based on current price 
 * (Feature #4 on Roadmap: Replace with real historical archive later)
 */
const generateHistory = (symbol, range, currentPrice) => {
  const points = { '1D': 20, '1W': 30, '1M': 30, '3M': 45, '6M': 60, '1Y': 100 }[range] || 20;
  const data = [];
  let lastPrice = currentPrice || 500;
  for (let i = points; i >= 0; i--) {
    const change = (Math.random() - 0.5) * (lastPrice * 0.02);
    lastPrice = lastPrice - change;
    data.push({
      time: i === 0 ? "Now" : `${i}p`,
      price: parseFloat(lastPrice.toFixed(2))
    });
  }
  return data.reverse();
};

app.get('/api/live-prices', async (req, res) => {
  const now = Date.now();
  // Serve from cache if fresh
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

    // Corrected Selector and Column Mapping for Merolagani Latest Market
    $('#ctl00_ContentPlaceHolder1_dgLiveMarket tr').each((i, row) => {
      if (i === 0) return; // Skip header
      const cols = $(row).find('td');
      if (cols.length < 10) return;

      stocks.push({
        symbol: $(cols[0]).text().trim(),
        price: parseFloat($(cols[1]).text().replace(/,/g, '')),
        high: parseFloat($(cols[6]).text().replace(/,/g, '')),
        low: parseFloat($(cols[7]).text().replace(/,/g, '')),
        volume: parseFloat($(cols[8]).text().replace(/,/g, '')),
        prev: parseFloat($(cols[9]).text().replace(/,/g, ''))
      });
    });

    if (stocks.length > 0) {
      priceCache = { data: stocks, lastFetched: now };
      res.json(stocks);
    } else {
      res.status(404).json({ error: "Scraper could not find data rows. Website structure may have changed." });
    }
  } catch (error) {
    console.error("Scraper Error:", error.message);
    if (priceCache.data) return res.json(priceCache.data);
    res.status(500).json({ error: "External data feed is currently unreachable." });
  }
});

app.get('/api/history', (req, res) => {
  const { symbol, range } = req.query;
  if (!symbol) return res.status(400).json({ error: "Stock symbol required" });
  
  const currentStock = priceCache.data ? priceCache.data.find(s => s.symbol === symbol) : null;
  const currentPrice = currentStock ? currentStock.price : 500;
  
  res.json(generateHistory(symbol, range || '1D', currentPrice));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`--- WATCH DOG BACKEND IS LIVE ---`);
  console.log(`Port: ${PORT}`);
  console.log(`Status: Monitoring NEPSE indices...`);
});
