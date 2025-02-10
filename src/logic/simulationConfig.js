// src/logic/simulationConfig.js

/**
 * simulation configuration parameters
 * 
 * this file centralizes all configurable parameters for the market simulation.
 * 
 * the new approach uses a fixed mapping:
 *   - "secondsPerMarketYear": the number of real seconds that correspond to one market year (365 days).
 *     for example, if set to 6, then 6 real seconds equal 1 market year.
 * 
 * this means the number of market days to generate (or fetch) is calculated as:
 *   numDays = Math.floor((timerSeconds / secondsPerMarketYear) * 365);
 * 
 */

// constant representing the number of days in a market year.
const DAYS_IN_YEAR = 365;

let SIMULATION_PARAMS = {
  // the total real-time duration of the simulation in seconds (default; can be updated via user input).
  simulationRealTimeSeconds: 30,
  
  // mapping parameter: how many real seconds correspond to 1 market year.
  // for instance, with secondsPerMarketYear = 10, 10 seconds of real time equal 1 market year (365 days).
  secondsPerMarketYear: 10,
  
  // market dynamics parameters for the simulated (GBM) mode.
  annualDrift: 0.09,      // expected annual return
  annualVolatility: 0.20, // annual volatility
  
  // smoothing parameter: the window size for the rolling average.
  // this value is fixed and should only be changed by the developer.
  windowSize: 10,
  
  // toggle for using real market data versus simulated data.
  realMode: false,
  
  // for real mode: number of data points plotted per second.
  realMarketDataFrequency: 37
};

/**
 * 
 * @param {Object} newParams - an object containing the parameters to update.
 */
export function setSimulationParams(newParams) {
  SIMULATION_PARAMS = { ...SIMULATION_PARAMS, ...newParams };
}

/**
 * retrieves the current simulation parameters.
 * 
 * @returns {Object} the current simulation configuration.
 */
export function getSimulationParams() {
  return SIMULATION_PARAMS;
}