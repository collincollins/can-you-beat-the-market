// src/logic/simulation.js
import { marketData, userPortfolio } from './store';
import { SIMULATION_PARAMS } from './simulationConfig';

/**
 * Simulation Module
 * 
 * This module handles the core simulation logic, including price generation,
 * market updates, and user portfolio management.
 */

// Destructure simulation parameters for easy access
const { daysPerStep, annualDrift, annualVolatility, windowSize } = SIMULATION_PARAMS;

const dt = daysPerStep / 365; // Time increment in years

// Simulation state variables
let currentDay = 0;
let currentPrice = 100;
let userShares = 1;
let userCash = 0;
let simulationInterval = null;

// Signal flags
let buySignal = false;
let sellSignal = false;

/**
 * Generates the next market price using Geometric Brownian Motion.
 * 
 * @param {number} price - The current market price.
 * @returns {number} - The next simulated market price.
 */
function getNextPrice(price) {
  const random = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(random)) * Math.cos(2.0 * Math.PI * Math.random());

  const driftComponent = (annualDrift - 0.5 * Math.pow(annualVolatility, 2)) * dt;
  const diffusionComponent = annualVolatility * Math.sqrt(dt) * z;

  return price * Math.exp(driftComponent + diffusionComponent);
}

/**
 * Updates the market state by advancing the simulation and updating market data.
 */
function updateMarket() {
  currentDay += daysPerStep;
  currentPrice = getNextPrice(currentPrice);

  // Calculate user portfolio value
  const userValue = userShares * currentPrice + userCash;

  // Update marketData store
  marketData.update(data => {
    data.days.push(currentDay);
    data.marketPrices.push(parseFloat(currentPrice.toFixed(2)));

    // Calculate rolling average
    const len = data.marketPrices.length;
    const subset = data.marketPrices.slice(Math.max(0, len - windowSize), len);
    const sum = subset.reduce((a, b) => a + b, 0);
    const avg = sum / subset.length;
    data.rollingAverages.push(parseFloat(avg.toFixed(2)));

    return data;
  });

  // Update userPortfolio store
  userPortfolio.set({
    shares: userShares,
    cash: userCash,
    portfolioValue: parseFloat(userValue.toFixed(2)),
  });
}

/**
 * Starts the market simulation.
 * 
 * Initializes simulation state and begins the simulation interval.
 */
export function startSimulation() {
  // Reset simulation state
  currentDay = 0;
  currentPrice = 100;
  userShares = 1;
  userCash = 0;

  // Reset marketData store with initial values
  marketData.set({
    days: [0],
    marketPrices: [100],
    rollingAverages: [100],
    actions: [
      {
        type: 'buy',
        day: 0,
        executedPrice: 100
      }
    ]
  });

  // Reset userPortfolio store
  userPortfolio.set({
    shares: userShares,
    cash: userCash,
    portfolioValue: currentPrice,
  });

  // Clear any existing simulation interval
  if (simulationInterval) clearInterval(simulationInterval);

  // Start simulation loop
  simulationInterval = setInterval(() => {
    updateMarket();
    handleSignals();
  }, 1000 / 7); // ~142ms interval
}

/**
 * Handles buy and sell signals by executing corresponding actions.
 */
function handleSignals() {
  if (buySignal) {
    buyShares();
    buySignal = false;
  }
  if (sellSignal) {
    sellShares();
    sellSignal = false;
  }
}

/**
 * Executes a buy action if the user has available cash.
 */
function buyShares() {
  if (userCash > 0) {
    marketData.update(data => {
      const avgPrice = data.rollingAverages[data.rollingAverages.length - 1] || currentPrice;

      const sharesToBuy = userCash / avgPrice;
      userShares += sharesToBuy;
      userCash = 0;

      data.actions.push({
        type: 'buy',
        day: currentDay,
        executedPrice: avgPrice
      });

      return data;
    });
  }
}

/**
 * Executes a sell action if the user holds shares.
 */
function sellShares() {
  if (userShares > 0) {
    marketData.update(data => {
      const avgPrice = data.rollingAverages[data.rollingAverages.length - 1] || currentPrice;

      const cashGained = userShares * avgPrice;
      userCash += cashGained;
      userShares = 0;

      data.actions.push({
        type: 'sell',
        day: currentDay,
        executedPrice: avgPrice
      });

      return data;
    });
  }
}

/**
 * Sends a buy signal to trigger the buying of shares.
 */
export function sendBuySignal() {
  buySignal = true;
}

/**
 * Sends a sell signal to trigger the selling of shares.
 */
export function sendSellSignal() {
  sellSignal = true;
}

/**
 * Stops the market simulation by clearing the simulation interval.
 */
export function stopSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = null;
}