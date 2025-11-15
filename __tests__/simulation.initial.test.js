// __tests__/simulation.initial.test.js

import { MarketSimulation } from '../src/logic/simulation';
import { get } from 'svelte/store';
import { marketData, userPortfolio } from '../src/logic/store';

describe('MarketSimulation Initialization', () => {
  let simulation;

  beforeEach(() => {
    simulation = new MarketSimulation();
    simulation.resetState(); // Ensure state is reset before each test
  });

  test('should initialize with correct simulation values', () => {
    // After refactor: uses currentIndex instead of currentDay
    expect(simulation.currentIndex).toBe(0);
    expect(simulation.currentPrice).toBe(100);
    expect(simulation.userShares).toBe(1);
    expect(simulation.userCash).toBe(0);
    // rawData starts empty, populated during prepareDataset
    expect(simulation.rawData).toEqual([]);
  });

  test('should update the marketData store with initial values', () => {
    // After refactor: stores start empty, populated during simulation playback
    const initialMarketData = get(marketData);
    expect(initialMarketData.days).toEqual([]);
    expect(initialMarketData.marketPrices).toEqual([]);
    expect(initialMarketData.rollingAverages).toEqual([]);
    expect(initialMarketData.actions).toEqual([]);
  });

  test('should update the userPortfolio store with initial values', () => {
    // Get the initial userPortfolio from the Svelte store
    const initialPortfolio = get(userPortfolio);
    expect(initialPortfolio.shares).toBe(1);
    expect(initialPortfolio.cash).toBe(0);
    expect(initialPortfolio.portfolioValue).toBe(100);
  });
});