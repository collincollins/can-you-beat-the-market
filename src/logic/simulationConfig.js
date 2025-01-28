// src/logic/simulationConfig.js

/**
 * Simulation Configuration Parameters
 * 
 * This file contains all configurable parameters for the market simulation.
 * Adjust these values to tweak the behavior of the simulation.
 */

export const SIMULATION_PARAMS = {
    daysPerStep: 5.3,        // Number of days advanced per simulation step
    annualDrift: 0.08,       // Expected annual return of the market
    annualVolatility: 0.12,  // Annual volatility of the market
    windowSize: 2,            // Number of data points for rolling average
  };