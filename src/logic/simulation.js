// src/logic/simulation.js
import { marketData, userPortfolio } from './store';

// simulation parameters
// e.g. each step is 2.43 days => ~1 year in 30s if frequency=5 => 150 steps
// Right now it's 4.86 => about 2 years in 30s at 5 updates/sec
const daysPerStep = 5.09;
const annualDrift = 0.08;
const annualVol   = 0.10;
const dt = daysPerStep / 365;

// changes the speed of the market updates
let frequency = 12;

// simulation state
let currentDay = 0;
let currentPrice = 1000;
let userShares = 1;
let userCash = 0;
let simulationInterval = null;

// signals
let buySignal = false;
let sellSignal = false;

// geometric brownian motion
function getNextPrice(price) {
  const random = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(random)) * Math.cos(2.0 * Math.PI * Math.random());
  
  const driftComponent = (annualDrift - 0.5 * annualVol**2) * dt;
  const diffusionComponent = annualVol * Math.sqrt(dt) * z;
  
  return price * Math.exp(driftComponent + diffusionComponent);
}

function updateMarket() {
  currentDay += daysPerStep;
  currentPrice = getNextPrice(currentPrice);
  
  // update user portfolio value
  const userValue = userShares * currentPrice + userCash;
  
  // push data into marketData
  marketData.update(data => {
    data.days.push(currentDay);
    data.marketPrices.push(parseFloat(currentPrice.toFixed(2)));

    // rolling avg of last N items
    const windowSize = 5;
    const len = data.marketPrices.length;
    const start = Math.max(0, len - windowSize);
    const subset = data.marketPrices.slice(start, len);
    const sum = subset.reduce((a, b) => a + b, 0);
    const avg = sum / subset.length;

    data.rollingAverages.push(parseFloat(avg.toFixed(2)));

    return data;
  });
  
  // update userPortfolio
  userPortfolio.set({
    shares: userShares,
    cash: userCash,
    portfolioValue: parseFloat(userValue.toFixed(2)),
  });
}

export function startSimulation() {
  // reset simulation state
  currentDay = 0;
  currentPrice = 1000;
  userShares = 1;
  userCash = 0;

  // reset the store with day=0, price=100-, rolling=1000, plus initial Buy Action
  marketData.set({
    days: [0],
    marketPrices: [1000],
    rollingAverages: [1000],
    actions: [
      {
        type: 'buy',
        day: 0,
        executedPrice: 1000
      }
    ]
  });

  userPortfolio.set({
    shares: userShares,
    cash: userCash,
    portfolioValue: currentPrice,
  });

  // clear any existing interval
  if (simulationInterval) clearInterval(simulationInterval);

  // start simulation loop
  simulationInterval = setInterval(() => {
    updateMarket();
    handleSignals();
  }, 1000 / frequency);
}

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

function buyShares() {
  if (userCash > 0) {
    marketData.update(data => {
      // trade at rolling average
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

// signals
export function sendBuySignal() {
  buySignal = true;
}
export function sendSellSignal() {
  sellSignal = true;
}

export function stopSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
}