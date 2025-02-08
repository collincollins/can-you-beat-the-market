// src/logic/simulationConfig.js

/**
 * Simulation Configuration Parameters
 * 
 * Centralizes all configurable parameters for the market simulation.
 */

const DAYS_IN_YEAR = 365;

// Initial Simulation Parameters
let SIMULATION_PARAMS = {
  simulationDurationYears: 5,      // Total simulated years (for simulation mode)
  simulationRealTimeSeconds: 30,   // Total real-time duration of the simulation in seconds
  stepsPerSecond: 10,              // Number of simulation steps per second (for simulation mode)
  annualDrift: 0.09,               // Expected annual return of the market (for simulation mode)
  annualVolatility: 0.20,          // Annual volatility of the market (for simulation mode)
  windowSize: 2,                   // Number of data points for rolling average
  realMode: false,                 // Toggle for real market data mode
  realMarketDataFrequency: 61      // Number of real market data points plotted per second (rounded integer)
};

// Function to update simulation parameters
export function setSimulationParams(newParams) {
  SIMULATION_PARAMS = { ...SIMULATION_PARAMS, ...newParams };
}

// Function to retrieve current simulation parameters
export function getSimulationParams() {
  return SIMULATION_PARAMS;
}

// Derived Parameters for simulation mode (used when realMode is false)
export const getDaysPerStep = () => {
  const { simulationDurationYears, simulationRealTimeSeconds, stepsPerSecond } = SIMULATION_PARAMS;
  
  if (stepsPerSecond <= 0) {
    throw new Error("stepsPerSecond must be greater than 0");
  }

  return (simulationDurationYears * DAYS_IN_YEAR) / (simulationRealTimeSeconds * stepsPerSecond);
};

export const getSimulationIntervalMs = () => {
  const { stepsPerSecond, realMode, realMarketDataFrequency } = SIMULATION_PARAMS;
  return realMode ? 1000 / realMarketDataFrequency : 1000 / stepsPerSecond;
};