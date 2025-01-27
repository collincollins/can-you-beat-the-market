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

// High Score Store
export const highScore = writable({
  score: 0,
  playerName: 'No one yet'
});

// **Consecutive Wins Store**
export const consecutiveWins = writable(0);