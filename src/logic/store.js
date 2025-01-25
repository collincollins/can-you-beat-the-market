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