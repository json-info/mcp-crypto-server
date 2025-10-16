import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

const COINGECKO_URL = "https://api.coingecko.com/api/v3";

// 🧠 Helper: retry with delay to handle rate limit
async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, options);
      return response.data;
    } catch (err) {
      // Handle 429 (Too Many Requests)
      if (err.response && err.response.status === 429 && i < retries - 1) {
        console.warn(`⚠️ Rate limited — retrying in ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

// ✅ Current price
app.get("/crypto/:id/price", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fetchWithRetry(`${COINGECKO_URL}/simple/price`, {
      params: { ids: id, vs_currencies: "usd,php" },
    });
    res.json({ coin: id, price: data[id] });
  } catch (err) {
    console.error("❌ Error fetching price:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Historical chart
app.get("/crypto/:id/market_chart", async (req, res) => {
  const { id } = req.params;
  const { days } = req.query;
  try {
    const data = await fetchWithRetry(`${COINGECKO_URL}/coins/${id}/market_chart`, {
      params: { vs_currency: "usd", days: days || "365" },
    });
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching market chart:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Coin info (ATH/ATL)
app.get("/crypto/:id/info", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fetchWithRetry(`${COINGECKO_URL}/coins/${id}`);
    const info = {
      name: data.name,
      symbol: data.symbol,
      ath: data.market_data.ath.usd,
      ath_date: data.market_data.ath_date.usd,
      atl: data.market_data.atl.usd,
      atl_date: data.market_data.atl_date.usd,
    };
    res.json(info);
  } catch (err) {
    console.error("❌ Error fetching info:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Summary route (lahat ng mahalagang info)
app.get("/crypto/:id/summary", async (req, res) => {
  const { id } = req.params;
  try {
    const infoData = await fetchWithRetry(`${COINGECKO_URL}/coins/${id}`);
    const priceData = await fetchWithRetry(`${COINGECKO_URL}/simple/price`, {
      params: { ids: id, vs_currencies: "usd,php" },
    });

    const m = infoData.market_data;
    const currentUSD = priceData[id].usd;
    const percentBelowATH = ((m.ath.usd - currentUSD) / m.ath.usd * 100).toFixed(2);
    const percentAboveATL = ((currentUSD - m.atl.usd) / m.atl.usd * 100).toFixed(2);

    res.json({
      name: infoData.name,
      symbol: infoData.symbol,
      current_price: priceData[id],
      ath: { price: m.ath.usd, date: m.ath_date.usd },
      atl: { price: m.atl.usd, date: m.atl_date.usd },
      performance: {
        percent_below_ath: `${percentBelowATH}%`,
        percent_above_atl: `${percentAboveATL}%`
      }
    });
  } catch (err) {
    console.error("❌ Error in summary route:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(3000, () => console.log("✅ MCP Crypto Server running on port 3000"));
