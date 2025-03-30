// src/logic/simulation.js
import { marketData, userPortfolio } from './store';
import { getSimulationParams } from './simulationConfig';

/**
 * helper function: compute a simple moving average (rolling average) from an array of numbers.
 * the windowSize (smoothing parameter) is defined in the simulation config.
 */
function applyRollingAverage(data, windowSize) {
  const smoothed = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const subset = data.slice(start, i + 1);
    const sum = subset.reduce((acc, val) => acc + val, 0);
    smoothed.push(sum / subset.length);
  }
  return smoothed;
}

/**
 * MarketSimulation class
 * 
 * this version pre-generates (or fetches) an entire dataset for the full market period before
 * starting the simulation. the number of market days is determined by the real timer length, using:
 * 10 seconds of real time = 1 market year (365 days).
 * 
 * then a rolling average (smoothing) is applied to the entire dataset. this smoothed dataset is used
 * for plotting (the black line) and for executing all buy/sell transactions.
 */
export class MarketSimulation {
  constructor() {
    const { annualDrift, annualVolatility, windowSize, secondsPerMarketYear } = getSimulationParams();
    this.annualDrift = annualDrift;
    this.annualVolatility = annualVolatility;
    this.windowSize = windowSize;
    this.secondsPerMarketYear = secondsPerMarketYear

    // simulation state variables
    this.currentIndex = 0; // pointer into the precomputed dataset
    this.currentPrice = 100;
    this.userShares = 1;
    this.userCash = 0;

    // arrays to store the full dataset (raw and smoothed)
    this.rawData = [];      // raw prices (simulated or real)
    this.smoothedData = []; // after applying the rolling average

    // when in real market mode, store the corresponding dates.
    this.rawDates = [];

    // handle for the simulation interval timer
    this.simulationInterval = null;

    // reset the simulation state
    this.resetState();
  }

  resetState(realMode = false) {
    this.currentIndex = 0;
    // in simulation mode, start at 100; in real mode, clear the default.
    this.currentPrice = realMode ? null : 100;
    this.userShares = 1;
    this.userCash = 0;
    this.rawData = [];
    this.smoothedData = [];
    this.rawDates = [];
  
    // reset the Svelte stores used to plot market data and display the portfolio
    marketData.set({
      days: [],
      marketPrices: [],
      rollingAverages: [],
      actions: [],
    });
    userPortfolio.set({
      shares: this.userShares,
      cash: this.userCash,
      portfolioValue: this.currentPrice !== null ? this.currentPrice : 0,
    });
  }

  /**
   * generates simulated market data using a geometric Brownian motion (GBM) process.
   * generates exactly numDays of data (each day is one data point).
   */
  generateSimulatedDataset(numDays) {
    const data = [];
    let price = 100;
    // Use daily drift and volatility.
    const dailyDrift = (this.annualDrift - 0.5 * Math.pow(this.annualVolatility, 2)) / 365;
    const dailyVol = this.annualVolatility / Math.sqrt(365);
    for (let i = 0; i < numDays; i++) {
      const z = this.generateStandardNormal();
      price = price * Math.exp(dailyDrift + dailyVol * z);
      data.push(price);
    }
    return data;
  }

  /**
   * generates a standard normally distributed random variable using the Box–Muller transform.
   */
  generateStandardNormal() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * for real mode: fetches market data from the S&P500 dataset.
   * it selects a random contiguous slice of length numDays and "blinds" the dates by re-indexing.
   */
  async fetchRealDataset(numDays) {
    const response = await fetch('/data/sp500_filtered.json');
    const sp500Data = await response.json();
    if (sp500Data.length < numDays) {
      throw new Error("Not enough data in the SP500 dataset to cover the simulation duration.");
    }
    const maxStart = sp500Data.length - numDays;
    const startIndex = Math.floor(Math.random() * (maxStart + 1));
    const slice = sp500Data.slice(startIndex, startIndex + numDays);
    this.rawDates = slice.map(d => new Date(d.Date));
    const data = slice.map(d => d.Close);
    return data;
  }

  /**
   * prepares the full market dataset before starting the simulation.
   * based on the timer length (in seconds) and whether realMode is active:
   * - compute the number of market days using the mapping: 10 seconds = 1 year (365 days).
   * - if realMode is true, fetch that many data points; otherwise, generate them via GBM.
   * - then apply the rolling average using the smoothing parameter.
   */
  async prepareDataset(timerSeconds, realMode, adjustedFrequency, originalTimerInput = timerSeconds) {
    let numPoints;
    if (realMode) {
      // In real mode, use the full (adjusted) timer value.
      numPoints = timerSeconds * adjustedFrequency;
      this.rawData = await this.fetchRealDataset(numPoints);
    } else {
      // In simulated mode, if slowMo is on the original timerInput will be lower.
      // Use originalTimerInput (not the doubled value) to compute the number of days.
      const numYears = originalTimerInput / this.secondsPerMarketYear;
      const numDays = Math.floor(numYears * 365);
      this.rawData = this.generateSimulatedDataset(numDays);
    }
    this.smoothedData = applyRollingAverage(this.rawData, this.windowSize);
  }

  /**
   * starts the simulation playback.
   * first, it resets the state and precomputes the full dataset (raw and smoothed).
   * then it pre-populates the marketData store with the first data point and
   * sets an interval timer to "play back" the data over the full timer duration.
   *
   * @param {number} timerSeconds - the real-time duration of the simulation.
   * @param {boolean} realMode - if true, use real market data; if false, simulate data.
   */
  async start(timerSeconds, realMode, adjustedFrequency, originalTimerInput = timerSeconds) {
    // reset the simulation state.
    this.resetState(realMode);
    // pre-generate (or fetch) the dataset.
    await this.prepareDataset(timerSeconds, realMode, adjustedFrequency, originalTimerInput);

    // pre-populate the stores with the first data point.
    if (this.smoothedData.length > 0) {
      this.currentPrice = this.smoothedData[0];
      marketData.update(data => {
        data.days.push(1);
        data.marketPrices.push(parseFloat(this.rawData[0].toFixed(2)));
        data.rollingAverages.push(parseFloat(this.currentPrice.toFixed(2)));
        // place a buy marker at simulation start at day 1.
        data.actions.push({
          type: 'buy',
          day: 1,
          executedPrice: parseFloat(this.currentPrice.toFixed(2))
        });
        return data;
      });
      userPortfolio.set({
        shares: this.userShares,
        cash: this.userCash,
        portfolioValue: parseFloat((this.userShares * this.currentPrice + this.userCash).toFixed(2)),
      });
    }

    // determine how fast to play back the dataset.
    // the update interval is the timer duration (in ms) divided by the number of data points.
    const totalPoints = this.smoothedData.length;
    const intervalMs = (timerSeconds * 1000) / totalPoints;

    // start the interval that "plays back" the data point by point.
    this.simulationInterval = setInterval(() => {
      this.currentIndex++;
      if (this.currentIndex >= totalPoints) {
        this.stop();
        return;
      }
      this.currentPrice = this.smoothedData[this.currentIndex];

      // append the new data point to the marketData store.
      marketData.update(data => {
        data.days.push(this.currentIndex + 1);
        data.marketPrices.push(parseFloat(this.rawData[this.currentIndex].toFixed(2)));
        data.rollingAverages.push(parseFloat(this.currentPrice.toFixed(2)));
        return data;
      });

      // update the user portfolio value based on the current smoothed price.
      const portfolioValue = this.userShares * this.currentPrice + this.userCash;
      userPortfolio.set({
        shares: this.userShares,
        cash: this.userCash,
        portfolioValue: parseFloat(portfolioValue.toFixed(2)),
      });
    }, intervalMs);
  }

  /**
   * stops the simulation by clearing the interval.
   */
  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  /**
   * executes a buy action.
   * uses the current smoothed price as the execution price.
   */
  buyShares() {
    if (this.userCash > 0) {
      const executedPrice = this.currentPrice;
      const sharesToBuy = this.userCash / executedPrice;
      this.userShares += sharesToBuy;
      this.userCash = 0;

      marketData.update(data => {
        data.actions.push({
          type: 'buy',
          day: this.currentIndex + 1,
          executedPrice: parseFloat(executedPrice.toFixed(2)),
        });
        return data;
      });
      userPortfolio.set({
        shares: this.userShares,
        cash: this.userCash,
        portfolioValue: parseFloat((this.userShares * this.currentPrice + this.userCash).toFixed(2)),
      });
    }
  }

  /**
   * executes a sell action.
   * uses the current smoothed price as the execution price.
   */
  sellShares() {
    if (this.userShares > 0) {
      const executedPrice = this.currentPrice;
      const cashGained = this.userShares * executedPrice;
      this.userCash += cashGained;
      this.userShares = 0;

      marketData.update(data => {
        data.actions.push({
          type: 'sell',
          day: this.currentIndex + 1,
          executedPrice: parseFloat(executedPrice.toFixed(2)),
        });
        return data;
      });
      userPortfolio.set({
        shares: this.userShares,
        cash: this.userCash,
        portfolioValue: parseFloat((this.userShares * this.currentPrice + this.userCash).toFixed(2)),
      });
    }
  }
}

// instantiate a single simulation instance (Singleton Pattern)
const simulationInstance = new MarketSimulation();

// export the functions with the new API:
// note: The start() function now expects three parameters:
//   timerSeconds (the real time duration selected by the user)
//   realMode (boolean indicating whether to use real market data)
//   adjustedFrequency (frequency parameter for real market data points)
export const startSimulation = simulationInstance.start.bind(simulationInstance);
export const stopSimulation = simulationInstance.stop.bind(simulationInstance);
export const buyShares = simulationInstance.buyShares.bind(simulationInstance);
export const sellShares = simulationInstance.sellShares.bind(simulationInstance);
export const getCurrentRealMarketDates = () => {
  if (simulationInstance.rawDates && simulationInstance.rawDates.length > 0) {
    // use currentIndex to pick the last played date.
    // if the simulation ran its full course, currentIndex will be at rawDates.length - 1.
    return {
      startRealMarketDate: simulationInstance.rawDates[0],
      endRealMarketDate: simulationInstance.rawDates[simulationInstance.currentIndex]
    };
  } else {
    return null;
  }
};  