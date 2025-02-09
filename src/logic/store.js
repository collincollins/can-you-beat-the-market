// src/logic/store.js
import { writable } from 'svelte/store';

export const marketData = writable({
  days: [],
  marketPrices: [],
  rollingAverages: [],
  actions: []
});

export const userPortfolio = writable({
  shares: 1,
  cash: 0,
  portfolioValue: 0
});

// high score store
export const highScore = writable({
  score: 0,
  playerName: 'No one yet'
});

// consecutive Wins store
export const consecutiveWins = writable(0);

// sp500 data store
export const sp500DataStore = writable([]);

// ADD visitorData store:
export const visitorDataStore = writable([]);

export const precomputedChartDataStore = writable({
  cleanedData: [],
  meanData: [],
  slope: 0,
  intercept: 0,
  xMin: 0,
  xMax: 0,
  regressionPoints: []
});

// export writable to allow its usage in other files
export { writable };