import { marketData, userPortfolio } from './store';

// simulation parameters
const drift = 0.001; // slight positive drift per update (adjust as needed)
const volatility = 0.01; // volatility per update
const dt = 1; // time step (1 second for simulation)
let frequency = 5; // updates per second (modifiable)

// initialize simulation state
let currentDay = 0;
let currentPrice = 100; // starting price
let userShares = 1;
let userCash = 0;
let simulationInterval = null;

// signals for buy/sell actions
let buySignal = false;
let sellSignal = false;

// function to calculate next price using Geometric Brownian Motion
function getNextPrice(price) {
  const random = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(random)) * Math.cos(2.0 * Math.PI * Math.random());
  const driftComponent = (drift - 0.5 * volatility ** 2) * dt;
  const diffusionComponent = volatility * Math.sqrt(dt) * z;
  const nextPrice = price * Math.exp(driftComponent + diffusionComponent);
  return nextPrice;
}

// function to update market data
function updateMarket() {
  currentDay += 1;
  currentPrice = getNextPrice(currentPrice);

  // update user portfolio value
  const userValue = userShares * currentPrice + userCash;

  // update the marketData store
  marketData.update(data => {
    data.days.push(currentDay);
    data.marketPrices.push(parseFloat(currentPrice.toFixed(2)));
    return data;
  });

  // update userPortfolio store
  userPortfolio.set({
    shares: userShares,
    cash: userCash,
    portfolioValue: parseFloat(userValue.toFixed(2)),
  });
}

// function to start the simulation
export function startSimulation() {
  // reset simulation state
  currentDay = 0;
  currentPrice = 100;
  userShares = 1;
  userCash = 0;

  // reset stores
  marketData.set({
    days: [],
    marketPrices: [],
    actions: [],
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
    for (let i = 0; i < frequency; i++) {
      updateMarket();
      handleSignals();
    }
  }, 1000 / frequency); // adjust interval timing based on frequency
}

// function to handle buy/sell signals
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

// buy function: Buy as many shares as possible with all cash
function buyShares() {
  if (userCash > 0) {
    const sharesToBuy = userCash / currentPrice;
    userShares += sharesToBuy;
    userCash = 0;

    // record buy action
    marketData.update(data => {
      data.actions.push({ type: 'buy', day: currentDay });
      return data;
    });
  }
}

// sell function: Sell all shares and convert to cash
function sellShares() {
  if (userShares > 0) {
    userCash += userShares * currentPrice;
    userShares = 0;

    // record sell action
    marketData.update(data => {
      data.actions.push({ type: 'sell', day: currentDay });
      return data;
    });
  }
}

// functions to send buy/sell signals
export function sendBuySignal() {
  buySignal = true;
}

export function sendSellSignal() {
  sellSignal = true;
}

// function to stop the simulation
export function stopSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
}