// ./logic/prepareSp500ChartData.js

// Cache the S&P 500 data so it's only fetched once per session
let cachedSp500Data = null;

export async function fetchAndPrepFullSp500(windowSize) {
  // Return cached data if available
  if (cachedSp500Data) {
    console.log('Using cached S&P 500 data');
    return cachedSp500Data;
  }

  console.log('Fetching S&P 500 data for the first time');
  
  // 1. fetch
  const response = await fetch('/data/sp500_filtered.json');
  const rawData = await response.json();

  // 2. apply rolling average
  const smoothed = applyRollingAverage(rawData.map(d => d.Close), windowSize);

  // 3. combine into weekly points
  const datasetData = rawData.map((d, i) => ({
    x: new Date(d.Date),
    y: smoothed[i]
  }));
  const weeklyData = datasetData.filter((_, i) => i % 5 === 0);

  // compute overall min/max if you want them
  const allPrices = weeklyData.map(d => d.y);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  // Cache the result
  cachedSp500Data = {
    weeklyData, // The entire pre-smoothed set
    minPrice,
    maxPrice,
  };

  return cachedSp500Data;
}

// rolling average function for smoothing the data.
function applyRollingAverage(data, windowSize) {
  const smoothed = [];
  for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const subset = data.slice(start, i + 1);
      const sum = subset.reduce((acc, val) => acc + val, 0);
      smoothed.push(sum / subset.length);
  }
  return smoothed;
}