// __tests__/simulation.test.js

import { MarketSimulation } from '../src/logic/simulation';
import { SIMULATION_PARAMS, DAYS_PER_STEP } from '../src/logic/simulationConfig';

describe('MarketSimulation Long-Term Behavior', () => {
  // **Test Configuration**
  const years = 100; // Simulation duration in years
  const numSimulations = 100; // Number of simulation runs for averaging

  // **Theoretical Calculations**
  const theoreticalCagr = (Math.exp(SIMULATION_PARAMS.annualDrift - 0.5 * Math.pow(SIMULATION_PARAMS.annualVolatility, 2)) - 1) * 100; // Corrected ~7.25%
  const theoreticalVolatility = SIMULATION_PARAMS.annualVolatility * 100; // 20%

  // **Tolerance Levels**
  const cagrTolerance = 1.0; // Allow ±1%
  const volatilityTolerance = 2.0; // Allow ±2%

  test(`should have average annual drift approximately equal to ${theoreticalCagr.toFixed(2)}% over ${years} years across ${numSimulations} simulations`, () => {
    let totalCagr = 0;

    for (let i = 0; i < numSimulations; i++) {
      // Initialize and reset simulation
      const simulation = new MarketSimulation();
      simulation.resetState();

      // Calculate the number of steps
      const steps = Math.floor((years * 365) / DAYS_PER_STEP);

      // Run the simulation
      for (let step = 0; step < steps; step++) {
        simulation.updateMarket();
      }

      // Calculate CAGR for this simulation
      const initialValue = 100; // Starting price
      const finalValue = simulation.allPrices[simulation.allPrices.length - 1];
      const cagr = ((finalValue / initialValue) ** (1 / years) - 1) * 100;

      totalCagr += cagr;
    }

    // Calculate average CAGR
    const averageCagr = totalCagr / numSimulations;

    console.log(`Average CAGR after ${years} years across ${numSimulations} simulations: ${averageCagr.toFixed(2)}%`);

    // Assert that average CAGR is within the tolerance
    expect(averageCagr).toBeGreaterThanOrEqual(theoreticalCagr - cagrTolerance);
    expect(averageCagr).toBeLessThanOrEqual(theoreticalCagr + cagrTolerance);
  });

  test(`should have average annual volatility approximately equal to ${theoreticalVolatility.toFixed(2)}% over ${years} years across ${numSimulations} simulations`, () => {
    let totalVolatility = 0;

    for (let i = 0; i < numSimulations; i++) {
      // Initialize and reset simulation
      const simulation = new MarketSimulation();
      simulation.resetState();

      // Calculate the number of steps
      const steps = Math.floor((years * 365) / DAYS_PER_STEP);

      // Run the simulation
      for (let step = 0; step < steps; step++) {
        simulation.updateMarket();
      }

      // Calculate log returns for this simulation
      const logReturns = [];
      for (let j = 1; j < simulation.allPrices.length; j++) {
        const priceToday = simulation.allPrices[j];
        const priceYesterday = simulation.allPrices[j - 1];
        const logReturn = Math.log(priceToday / priceYesterday);
        logReturns.push(logReturn);
      }

      // Calculate mean of log returns
      const mean = logReturns.reduce((acc, val) => acc + val, 0) / logReturns.length;

      // Calculate variance of log returns
      const variance = logReturns.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (logReturns.length - 1);

      // Calculate standard deviation of log returns
      const stepStdDev = Math.sqrt(variance);

      // Annualize volatility
      const stepsPerYear = 365 / DAYS_PER_STEP; // ~60 steps per year
      const annualVolatility = stepStdDev * Math.sqrt(stepsPerYear) * 100; // Convert to percentage

      totalVolatility += annualVolatility;
    }

    // Calculate average volatility
    const averageVolatility = totalVolatility / numSimulations;

    console.log(`Average Annual Volatility after ${years} years across ${numSimulations} simulations: ${averageVolatility.toFixed(2)}%`);

    // Assert that average volatility is within the tolerance
    expect(averageVolatility).toBeGreaterThanOrEqual(theoreticalVolatility - volatilityTolerance);
    expect(averageVolatility).toBeLessThanOrEqual(theoreticalVolatility + volatilityTolerance);
  });
});