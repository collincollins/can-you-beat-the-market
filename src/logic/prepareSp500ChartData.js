// ./logic/prepareSp500ChartData.js

// Cache the S&P 500 raw data (before processing)
let cachedRawData = null;

export async function fetchAndPrepFullSp500(windowSize) {
  // Fetch raw data only once, cache it
  if (!cachedRawData) {
    console.log('Fetching S&P 500 raw data for the first time');
    const response = await fetch('/data/sp500_filtered.json');
    cachedRawData = await response.json();
  } else {
    console.log('Using cached S&P 500 raw data');
  }

  // Always process with the current windowSize (don't cache processed data)
  const smoothed = applyRollingAverage(cachedRawData.map(d => d.Close), windowSize);

  // 3. combine into weekly points
  const datasetData = cachedRawData.map((d, i) => ({
    x: new Date(d.Date),
    y: smoothed[i]
  }));
  const weeklyData = datasetData.filter((_, i) => i % 5 === 0);

  // compute overall min/max if you want them
  const allPrices = weeklyData.map(d => d.y);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  return {
    weeklyData, // The entire pre-smoothed set
    minPrice,
    maxPrice,
  };
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