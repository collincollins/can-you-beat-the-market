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

    // Properties for real market data mode
    this.realData = null;
    this.currentRealDataIndex = 0;
    this.marketStartDate = null;
    this.marketEndDate = null;

    this.resetState();
    this.simulationInterval = null;

    // For testing purposes, store all prices (initial price 100)
    this.allPrices = [100];
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

    // Reset allPrices and real data pointers
    this.allPrices = [100];
    this.realData = null;
    this.currentRealDataIndex = 0;
    this.marketStartDate = null;
    this.marketEndDate = null;
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
   * This is only used when realMode is false.
   * @param {number} price - Current market price.
   * @returns {number} Next simulated market price.
   */
  getNextPrice(price) {
    const z = this.generateStandardNormal();
    // const { simulationDurationYears, simulationRealTimeSeconds, stepsPerSecond } = getSimulationParams();
    const drift = (this.annualDrift - 0.5 * Math.pow(this.annualVolatility, 2)) * getDaysPerStep() / 365;
    const diffusion = this.annualVolatility * Math.sqrt(getDaysPerStep() / 365) * z;
    return price * Math.exp(drift + diffusion);
  }

  /**
 * Loads a random slice of real market data from the SP500 dataset.
 * Builds a simulation-scoped dataset with "blinded" dates (sequential day numbers)
 * and stores the original start/end dates.
 */
  async loadRealMarketData() {
    const response = await fetch('/data/sp500_filtered.json');
    const sp500Data = await response.json();
    const { simulationRealTimeSeconds, realMarketDataFrequency } = getSimulationParams();
    // Calculate the required number of datapoints based on timer length and frequency.
    const requiredDataPoints = simulationRealTimeSeconds * realMarketDataFrequency;
    const maxStartIndex = sp500Data.length - requiredDataPoints;
    if (maxStartIndex < 0) {
      throw new Error("Not enough SP500 data to cover the simulation duration.");
    }
    // Uniformly select a valid starting index.
    const randomStart = Math.floor(Math.random() * (maxStartIndex + 1));
    const selectedSlice = sp500Data.slice(randomStart, randomStart + requiredDataPoints);
    // Build the simulation-scoped dataset: use a sequential day counter and the "Close" value.
    this.realData = selectedSlice.map((d, i) => {
      return { day: i + 1, price: d.Close };
    });
    // Store the original start and end dates for later use.
    this.marketStartDate = selectedSlice[0].Date;
    this.marketEndDate = selectedSlice[selectedSlice.length - 1].Date;
    // Reset the pointer for stepping through the dataset.
    this.currentRealDataIndex = 0;
  }

  /**
   * Updates the market state by advancing the simulation.
   * In real mode, the next data point is taken from the preselected real data slice.
   * Otherwise, the next price is computed using GBM.
   */
  updateMarket() {
    const params = getSimulationParams();
    if (params.realMode && this.realData) {
      // Use the next data point from the real market slice.
      if (this.currentRealDataIndex < this.realData.length) {
        const dataPoint = this.realData[this.currentRealDataIndex];
        this.currentPrice = dataPoint.price;
        this.currentDay = dataPoint.day;
        this.currentRealDataIndex++;
        this.allPrices.push(this.currentPrice);
      } else {
        // Stop simulation if we run out of real data.
        this.stop();
        return;
      }
    } else {
      // Simulated (GBM) price generation.
      this.currentDay += getDaysPerStep();
      this.currentPrice = this.getNextPrice(this.currentPrice);
      this.allPrices.push(this.currentPrice);
    }

    // Update the user portfolio value.
    const userValue = this.userShares * this.currentPrice + this.userCash;

    // Update the marketData store.
    marketData.update(data => {
      data.days.push(this.currentDay);
      data.marketPrices.push(parseFloat(this.currentPrice.toFixed(2)));

      // Compute the rolling average with the specified window size (assumed here as 2).
      const len = data.marketPrices.length;      
      if (len >= 2) {
        const avg = (data.marketPrices[len - 2] + data.marketPrices[len - 1]) / 2;
        data.rollingAverages.push(parseFloat(avg.toFixed(2)));
      } else {
        data.rollingAverages.push(parseFloat(this.currentPrice.toFixed(2)));
      }
      return data;
    });

    // Update the userPortfolio store.
    userPortfolio.set({
      shares: this.userShares,
      cash: this.userCash,
      portfolioValue: parseFloat(userValue.toFixed(2)),
    });
  }

  /**
   * Starts the simulation loop.
   * If real mode is enabled, loads the real market data slice first.
   */
// Inside src/logic/simulation.js

start() {
  // Reset simulation state (this sets marketData to start with 100)
  this.resetState();
  // Stop any running simulation.
  if (this.simulationInterval) this.stop();

  const params = getSimulationParams();
  if (params.realMode) {
    // In real mode, load the real market data first.
    this.loadRealMarketData().then(() => {
      // Override the default initial values with those from the real data.
      marketData.set({
        days: [this.realData[0].day],
        marketPrices: [this.realData[0].price],
        rollingAverages: [this.realData[0].price],
        actions: []  // start with no actions yet
      });
      
      const startingPrice = this.realData[0].price;
      
      // Optionally, push an initial "buy" event using the first real data point.
      marketData.update(data => {
        data.actions.push({
          type: 'buy',
          day: this.realData[0].day,          // e.g. 1
          executedPrice: this.realData[0].price // the starting price from the real dataset
        });
        return data;
      });
      
      // Update the simulation's current state.
      this.currentPrice = startingPrice;
      this.currentDay = this.realData[0].day;
      
      // Now start the simulation loop.
      this.simulationInterval = setInterval(() => this.updateMarket(), getSimulationIntervalMs());
    }).catch(error => {
      console.error("Error loading real market data:", error);
    });
  } else {
    // For simulation mode, push the standard auto-buy event.
    marketData.update(data => {
      data.actions.push({
        type: 'buy',
        day: 0,
        executedPrice: 100,
      });
      return data;
    });
    this.simulationInterval = setInterval(() => this.updateMarket(), getSimulationIntervalMs());
  }
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