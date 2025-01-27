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

// New Store for High Score
export const highScore = writable({
  score: 0,
  playerName: 'No one yet'
});