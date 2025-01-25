import { writable } from 'svelte/store';

// global state for the simulation
export const marketData = writable({
  days: [],
  marketPrices: [],
  actions: [], // store buy and sell actions
});

export const userPortfolio = writable({
  shares: 1,
  cash: 0,
  portfolioValue: 0,
});