const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

let priceCache = { data: null, lastFetched: 0 };
const CACHE_DURATION = 60 * 1000; 

app.get('/api/live-prices', async (req, res) => {
  const now = Date.now();
  if (priceCache.data && (now - priceCache.lastFetched < CACHE_DURATION)) {
    return res.json(priceCache.data);
  }

  try {
    const { data: html } = await axios.get('https://merolagani.com/LatestMarket.aspx', { 
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
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

    priceCache = { data: stocks, lastFetched: now };
    res.json(stocks);
  } catch (error) {
    console.error("Fetch failed:", error.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Backend running on port ' + PORT));

app.get('/api/history', (req, res) => {
  const { symbol, range } = req.query;
  // This is a placeholder. In your real server.js, 
  // you would fetch historical prices from a DB or provider here.
  const data = Array.from({ length: 20 }, (_, i) => ({
    time: i + ":00",
    price: 500 + Math.random() * 50
  }));
  res.json(data);
});

