// __tests__/simulation.test.js
// Tests for MarketSimulation statistical properties

import { MarketSimulation } from '../src/logic/simulation';
import { setSimulationParams, getSimulationParams } from '../src/logic/simulationConfig';

describe('MarketSimulation Statistical Properties', () => {
  const years = 20;
  const numSimulations = 50;
  const DAYS_IN_YEAR = 365;

  // Tolerance levels
  const cagrTolerance = 1.5; // Allow ±1.5%
  const volatilityTolerance = 3.0; // Allow ±3%

  beforeAll(() => {
    setSimulationParams({
      annualDrift: 0.09,
      annualVolatility: 0.20,
      windowSize: 2,
    });
  });

  test('generateSimulatedDataset produces data with correct statistical properties', () => {
    const simulation = new MarketSimulation();
    const simulationParams = getSimulationParams();

    // Theoretical CAGR based on geometric Brownian motion
    const theoreticalCagr =
      (Math.exp(simulationParams.annualDrift - 0.5 * Math.pow(simulationParams.annualVolatility, 2)) - 1) * 100;

    let totalCagr = 0;

    for (let i = 0; i < numSimulations; i++) {
      const numDays = years * DAYS_IN_YEAR;
      const prices = simulation.generateSimulatedDataset(numDays);

      expect(prices.length).toBe(numDays);
      // First price is already evolved from initial 100, not 100 itself
      expect(prices[0]).toBeGreaterThan(0);

      // Calculate CAGR
      const finalPrice = prices[prices.length - 1];
      const cagr = (Math.pow(finalPrice / 100, 1 / years) - 1) * 100;
      totalCagr += cagr;
    }

    const avgCagr = totalCagr / numSimulations;

    // Check if average CAGR is close to theoretical
    expect(Math.abs(avgCagr - theoreticalCagr)).toBeLessThan(cagrTolerance);
  });

  test('generateSimulatedDataset produces data with correct volatility', () => {
    const simulation = new MarketSimulation();
    const simulationParams = getSimulationParams();
    const theoreticalVolatility = simulationParams.annualVolatility * 100;

    let totalVolatility = 0;

    for (let i = 0; i < numSimulations; i++) {
      const numDays = years * DAYS_IN_YEAR;
      const prices = simulation.generateSimulatedDataset(numDays);

      // Calculate log returns
      const logReturns = [];
      for (let j = 1; j < prices.length; j++) {
        logReturns.push(Math.log(prices[j] / prices[j - 1]));
      }

      // Calculate annualized volatility
      const mean = logReturns.reduce((sum, val) => sum + val, 0) / logReturns.length;
      const variance = logReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / logReturns.length;
      const dailyStdDev = Math.sqrt(variance);
      const annualizedVolatility = dailyStdDev * Math.sqrt(DAYS_IN_YEAR) * 100;

      totalVolatility += annualizedVolatility;
    }

    const avgVolatility = totalVolatility / numSimulations;

    // Check if average volatility is close to theoretical
    expect(Math.abs(avgVolatility - theoreticalVolatility)).toBeLessThan(volatilityTolerance);
  });

  test('resetState clears all simulation data', () => {
    const simulation = new MarketSimulation();

    // Generate some data
    simulation.generateSimulatedDataset(100);

    // Reset
    simulation.resetState();

    expect(simulation.currentIndex).toBe(0);
    expect(simulation.currentPrice).toBe(100);
    expect(simulation.userShares).toBe(1);
    expect(simulation.userCash).toBe(0);
    expect(simulation.rawData).toEqual([]);
    expect(simulation.smoothedData).toEqual([]);
  });

  test('generateStandardNormal produces values with correct distribution', () => {
    const simulation = new MarketSimulation();
    const samples = 10000;
    const values = [];

    for (let i = 0; i < samples; i++) {
      values.push(simulation.generateStandardNormal());
    }

    // Calculate mean and standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Standard normal should have mean ≈ 0 and std dev ≈ 1
    expect(Math.abs(mean)).toBeLessThan(0.05); // Very close to 0
    expect(Math.abs(stdDev - 1)).toBeLessThan(0.05); // Very close to 1
  });
});
