// __tests__/simulation.test.js

import { MarketSimulation } from '../src/logic/simulation';
import { setSimulationParams, getSimulationParams, getDaysPerStep } from '../src/logic/simulationConfig';

describe('MarketSimulation Long-Term Behavior', () => {
  // **Test Configuration**
  const years = 100; // Simulation duration in years
  const numSimulations = 100; // Number of simulation runs for averaging

  // **Tolerance Levels**
  const cagrTolerance = 1.0; // Allow ±1%
  const volatilityTolerance = 2.0; // Allow ±2%

  // **Constants**
  const DAYS_IN_YEAR = 365;

  // **Before All Tests, Set Simulation Parameters**
  beforeAll(() => {
    setSimulationParams({
      simulationDurationYears: years,
      simulationRealTimeSeconds: 30, // Total real-time duration (not directly used in tests)
      stepsPerSecond: 1000, // High steps per second to speed up tests
      annualDrift: 0.09, // 9% annual drift
      annualVolatility: 0.20, // 20% annual volatility
      windowSize: 2, // Rolling average window size
    });
  });

  // **After All Tests, Reset Simulation Parameters to Default (Optional)**
  afterAll(() => {
    setSimulationParams({
      simulationDurationYears: 5,
      simulationRealTimeSeconds: 30,
      stepsPerSecond: 10,
      annualDrift: 0.09,
      annualVolatility: 0.20,
      windowSize: 2,
    });
  });

  // **Retrieve Updated Simulation Parameters**
  const simulationParams = getSimulationParams();

  // **Theoretical Calculations Based on Updated Parameters**
  const theoreticalCagr = (Math.exp(simulationParams.annualDrift - 0.5 * Math.pow(simulationParams.annualVolatility, 2)) - 1) * 100;
  const theoreticalVolatility = simulationParams.annualVolatility * 100; // 20%

  test(`should have average annual drift approximately equal to ${theoreticalCagr.toFixed(2)}% over ${years} years across ${numSimulations} simulations`, () => {
    let totalCagr = 0;

    for (let i = 0; i < numSimulations; i++) {
      // Initialize and reset simulation
      const simulation = new MarketSimulation();
      simulation.resetState();

      // Calculate the number of steps based on updated simulation parameters
      const daysPerStep = getDaysPerStep(); // Derived from simulation params
      const steps = Math.floor((years * DAYS_IN_YEAR) / daysPerStep);

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

      // Calculate the number of steps based on updated simulation parameters
      const daysPerStep = getDaysPerStep();
      const steps = Math.floor((years * DAYS_IN_YEAR) / daysPerStep);

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
      const stepsPerYear = DAYS_IN_YEAR / daysPerStep;
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