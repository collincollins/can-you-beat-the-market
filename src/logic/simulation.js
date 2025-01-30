// src/logic/simulation.js
import { marketData, userPortfolio } from './store';
import { getSimulationParams, getDaysPerStep, getSimulationIntervalMs } from './simulationConfig';

/**
 * Simulation Class
 * 
 * Encapsulates the entire simulation logic and state.
 */
export class MarketSimulation { // Export the class for testing
  constructor() {
    const { annualDrift, annualVolatility, windowSize } = getSimulationParams();
    this.annualDrift = annualDrift;
    this.annualVolatility = annualVolatility;
    this.windowSize = windowSize;

    this.resetState();
    this.simulationInterval = null;

    // For testing purposes, store all prices
    this.allPrices = [100]; // Initial price
  }

  /**
   * Resets the simulation state to initial values.
   */
  resetState() {
    this.currentDay = 0;
    this.currentPrice = 100;
    this.userShares = 1;
    this.userCash = 0;

    // Initialize marketData store
    marketData.set({
      days: [0],
      marketPrices: [100],
      rollingAverages: [100],
      actions: [],
    });

    // Initialize userPortfolio store
    userPortfolio.set({
      shares: this.userShares,
      cash: this.userCash,
      portfolioValue: this.currentPrice,
    });

    // Reset allPrices
    this.allPrices = [100];
  }

  /**
   * Generates a standard normally distributed random variable using Box-Muller transform.
   * @returns {number} Standard normal random variable.
   */
  generateStandardNormal() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Avoid log(0)
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Calculates the next market price using Geometric Brownian Motion.
   * @param {number} price - Current market price.
   * @returns {number} Next simulated market price.
   */
  getNextPrice(price) {
    const z = this.generateStandardNormal();
    const { simulationDurationYears, simulationRealTimeSeconds, stepsPerSecond } = getSimulationParams();
    const drift = (this.annualDrift - 0.5 * Math.pow(this.annualVolatility, 2)) * getDaysPerStep() / 365;
    const diffusion = this.annualVolatility * Math.sqrt(getDaysPerStep() / 365) * z;
    return price * Math.exp(drift + diffusion);
  }

  /**
   * Updates the market state by advancing the simulation.
   */
  updateMarket() {
    this.currentDay += getDaysPerStep();
    this.currentPrice = this.getNextPrice(this.currentPrice);
    this.allPrices.push(this.currentPrice);

    // Update user portfolio value
    const userValue = this.userShares * this.currentPrice + this.userCash;

    // Update marketData store
    marketData.update(data => {
      data.days.push(this.currentDay);
      data.marketPrices.push(parseFloat(this.currentPrice.toFixed(2)));

      // Optimize rolling average calculation for windowSize = 2
      const len = data.marketPrices.length;
      const avg = (data.marketPrices[len - 2] + data.marketPrices[len - 1]) / 2;
      data.rollingAverages.push(parseFloat(avg.toFixed(2)));

      return data;
    });

    // Update userPortfolio store
    userPortfolio.set({
      shares: this.userShares,
      cash: this.userCash,
      portfolioValue: parseFloat(userValue.toFixed(2)),
    });
  }

  /**
   * Starts the simulation loop.
   */
  start() {
    this.resetState();
    // If you want an auto-buy at the moment the user starts
    marketData.update(data => {
      data.actions.push({
        type: 'buy',
        day: 0,
        executedPrice: 100,
    });
    return data;
  });
    if (this.simulationInterval) this.stop();
    this.simulationInterval = setInterval(() => this.updateMarket(), getSimulationIntervalMs());
  }

  /**
   * Stops the simulation loop.
   */
  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  /**
   * Executes a buy action.
   */
  buyShares() {
    if (this.userCash > 0) {
      marketData.update(data => {
        const avgPrice = data.rollingAverages[data.rollingAverages.length - 1] || this.currentPrice;
        const sharesToBuy = this.userCash / avgPrice;
        this.userShares += sharesToBuy;
        this.userCash = 0;

        data.actions.push({
          type: 'buy',
          day: this.currentDay,
          executedPrice: avgPrice,
        });

        return data;
      });

      // Update userPortfolio store
      userPortfolio.update(portfolio => ({
        ...portfolio,
        shares: this.userShares,
        cash: this.userCash,
        portfolioValue: parseFloat((this.userShares * this.currentPrice + this.userCash).toFixed(2)),
      }));
    }
  }

  /**
   * Executes a sell action.
   */
  sellShares() {
    if (this.userShares > 0) {
      marketData.update(data => {
        const avgPrice = data.rollingAverages[data.rollingAverages.length - 1] || this.currentPrice;
        const cashGained = this.userShares * avgPrice;
        this.userCash += cashGained;
        this.userShares = 0;

        data.actions.push({
          type: 'sell',
          day: this.currentDay,
          executedPrice: avgPrice,
        });

        return data;
      });

      // Update userPortfolio store
      userPortfolio.update(portfolio => ({
        ...portfolio,
        shares: this.userShares,
        cash: this.userCash,
        portfolioValue: parseFloat((this.userShares * this.currentPrice + this.userCash).toFixed(2)),
      }));
    }
  }
}

// Instantiate a single simulation instance (Singleton Pattern)
const simulationInstance = new MarketSimulation();

export const startSimulation = simulationInstance.start.bind(simulationInstance);
export const stopSimulation = simulationInstance.stop.bind(simulationInstance);
export const buyShares = simulationInstance.buyShares.bind(simulationInstance);
export const sellShares = simulationInstance.sellShares.bind(simulationInstance);