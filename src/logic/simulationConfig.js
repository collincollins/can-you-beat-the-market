// src/logic/simulationConfig.js

/**
 * Simulation Configuration Parameters
 * 
 * Centralizes all configurable parameters for the market simulation.
 */

const DAYS_IN_YEAR = 365;

// Initial Simulation Parameters
let SIMULATION_PARAMS = {
  simulationDurationYears: 5,      // Total simulated years
  simulationRealTimeSeconds: 30,   // Total real-time duration of the simulation in seconds
  stepsPerSecond: 10,              // Number of simulation steps per second
  annualDrift: 0.09,               // Expected annual return of the market
  annualVolatility: 0.20,          // Annual volatility of the market
  windowSize: 2,                    // Number of data points for rolling average
};

// Function to update simulation parameters
export function setSimulationParams(newParams) {
  SIMULATION_PARAMS = { ...SIMULATION_PARAMS, ...newParams };
}

// Function to retrieve current simulation parameters
export function getSimulationParams() {
  return SIMULATION_PARAMS;
}

// Derived Parameters
export const getDaysPerStep = () => {
  const { simulationDurationYears, simulationRealTimeSeconds, stepsPerSecond } = SIMULATION_PARAMS;
  
  if (stepsPerSecond <= 0) {
    throw new Error("stepsPerSecond must be greater than 0");
  }

  return (simulationDurationYears * DAYS_IN_YEAR) / (simulationRealTimeSeconds * stepsPerSecond);
};

export const getSimulationIntervalMs = () => {
  const { stepsPerSecond } = SIMULATION_PARAMS;
  return 1000 / stepsPerSecond;
};