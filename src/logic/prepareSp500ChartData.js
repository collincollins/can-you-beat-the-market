// ./logic/prepareSp500ChartData.js

export async function fetchAndPrepFullSp500(windowSize = 1) {
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

  return {
    weeklyData, // The entire pre-smoothed set
    minPrice,
    maxPrice,
  };
}

// rolling average function for smoothing the data.
function applyRollingAverage(data, windowSize = 1) {
  const smoothed = [];
  for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const subset = data.slice(start, i + 1);
      const sum = subset.reduce((acc, val) => acc + val, 0);
      smoothed.push(sum / subset.length);
  }
  return smoothed;
}