<script>
  import { onDestroy } from 'svelte';
  import MarketChart from './components/MarketChart.svelte';
  import Controls from './components/Controls.svelte';
  import { startSimulation, stopSimulation } from './logic/simulation';
  import { userPortfolio, marketData } from './logic/store';
  // 1) bridging React -> Svelte import
  // Import the custom-element definition code:
  import './bridges/RetroCounterWrapper.jsx';
  import coffeeButton from '../src/assets/buy-me-a-coffee-button.png';

  // Simulation settings
  let simulationTime = 30;
  let timer = simulationTime;
  let simulationEnded = false;
  let simulationRunning = false;
  let finalComparison = '';
  let timerInterval;

  // User state
  let portfolio = { shares: 1, cash: 0, portfolioValue: 0 };
  let data = { days: [], marketPrices: [], actions: [] };
  let isHelpVisible = false;

  // Tracking buy-and-hold final value and color states
  let buyHoldFinal = 0;
  // Colors start as black
  let portfolioColor = 'black';
  let buyHoldColor = 'black';

  // Subscribe to stores
  const unsubscribePortfolio = userPortfolio.subscribe(value => {
    portfolio = value;
  });

  const unsubscribeMarketData = marketData.subscribe(value => {
    data = value;
  });

  onDestroy(() => {
    unsubscribePortfolio();
    unsubscribeMarketData();
    stopSimulation();
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });

  function toggleHelp() {
    isHelpVisible = !isHelpVisible;
  }

  function startSimulationHandler() {
    simulationEnded = false;
    simulationRunning = true;
    timer = simulationTime;

    // Reset text colors to black at the start of each new run
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';

    startSimulation();
    timerInterval = setInterval(() => {
      timer -= 1;
      if (timer <= 0) {
        endSimulation(timerInterval);
      }
    }, 1000);
  }

  function endSimulation(interval) {
    simulationEnded = true;
    simulationRunning = false;
    stopSimulation();

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Make sure we have marketPrices data to compare
    if (data.marketPrices.length > 0) {
      // Calculate final buy-and-hold and compare
      buyHoldFinal = parseFloat(data.marketPrices[data.marketPrices.length - 1].toFixed(2));
      const portfolioVal = parseFloat(portfolio.portfolioValue.toFixed(2));

      if (portfolioVal > buyHoldFinal) {
        portfolioColor = '#008b02'; // green
        buyHoldColor = '#f44336';   // red
      } else if (portfolioVal < buyHoldFinal) {
        portfolioColor = '#f44336'; // red
        buyHoldColor = '#008b02';   // green
      } else {
        // equal
        portfolioColor = '#008b02'; // green
        buyHoldColor = '#008b02';   // green
      }

      // Build the finalComparison string with the correct color for buy-and-hold
      finalComparison = `
        <span style="color:${buyHoldColor}">
          Buy-and-Hold Value<br>
          $${buyHoldFinal.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </span>
      `;
    }
  }

  function restartSimulation() {
    simulationEnded = false;
    simulationRunning = false;
    timer = simulationTime;

    // Reset colors to black
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';

    // Reset market data and user portfolio
    marketData.set({
      days: [],
      marketPrices: [],
      rollingAverages: [],
      actions: [],
    });

    userPortfolio.set({
      shares: 1,
      cash: 0,
      portfolioValue: 0,
    });
  }

  // Handlers for buy/sell events
  function handleBuy() {
  }

  function handleSell() {
  }

  // Handle simulation time change
  function handleSimulationTimeChange(event) {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0) {
      simulationTime = value;
      timer = simulationTime;
      if (simulationRunning) {
        stopSimulation();
        startSimulation();
      }
    }
  }
</script>

<style>
  .app {
    font-family: 'Press Start 2P', cursive;
    text-align: center;
    margin-top: -10px;
    padding-top: 5px;
    padding-left: 15px;
    padding-right: 15px;
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.9em;
  }

  .header-container {
    position: relative;
    justify-content: center;
    margin-top: 20px;
    margin-bottom: 15px;
    padding-left: 12px;
    padding-right: 12px;
    padding-top: 0px;
    padding-bottom: 0px;
    background-color: #ccd0dcd9;
    border: 2px solid black;
    border-radius: 10px;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    width: 88%;
    max-width: 450px;
    font-size: 0.6em;
  }

  .header-card {
    margin-top: 15px;
    margin-bottom: 10px;
    justify-content: center;
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 0px;
    padding-bottom: 10px;
    background-color: #F3F4F6;
    border: 2px solid black;
    border-radius: 10px;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    max-width: auto;
    font-size: 1em;
  }

  .help-icon {
    font-size: .6em;
    padding: 8px;
  }

  .help-description {
    font-family: "Player Start 2P";
    font-size: 7pt;
    text-align: left;
    max-width: 700px;
    padding-left: 20px;
    padding-right: 20px;
  }

  .help-description-container {
    margin-top: 10px;
    padding: 0px;
    background-color: #ffffff;
    border: 1px solid #000000;
    border-radius: 8px;
    margin-bottom: 0;
    display: flex;
    margin-left: auto;
    margin-right: auto;
    justify-content: center;
    box-shadow: 1px 1px 0px #000000;
    font-size: 1em;
  }

  .timer {
    margin-top: 0px;
    margin-bottom: 0px;
    padding-left: 30px;
    padding-right: 30px;
    padding-top: 0px;
    padding-bottom: 5px;
    display: inline-block;
    font-size: 0.85em;
  }
  
  .portfolio {
    margin-top: 5px;
    padding: 10px;
    background-color: #fefeff;
    border: 2px solid #000000;
    border-radius: 10px;
    margin-bottom: 10px;
    display: flex;
    margin-left: auto;
    margin-right: auto;
    justify-content: center;
    max-width: 270px;
    box-shadow: 1px 1px 0px #000000;
    font-size: 1em;
  }

  .results {
    margin-top: 10px;
    margin-bottom: 0px;
    padding-left: 30px;
    padding-right: 30px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #F3F4F6;
    border: 2px solid black;
    border-radius: 10px;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    font-size: 1em; 
  }

  .chart-container {
    position: relative;
    background-color: #F3F4F6;
    height: 250px;
    width: 98%;
    max-width: 800px;
    margin-top: 0px;
    margin-bottom: 0px;
    padding-left: 18px;
    padding-right: 0px;
    padding-top: 15px;
    padding-bottom: 33px;
    border: 2px solid black;
    border-radius: 15px;
    box-shadow: 2px 2px 0px black;
  }

  button {
    font-family: 'Press Start 2P', cursive;
    background-color: #435b9f;
    border: 2px solid black;
    color: white;
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 10px;
    padding-bottom: 10px;
    text-align: center;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    border-radius: 10px;
    font-size: 1.2em;
    cursor: pointer;
  }

  button:hover {
    background-color: #384d86; /* slightly darker shade of the original color */
}
  
  .stop {
    background-color: #878282ae;
  }

  .buttons-container {
    margin-top: 5px;
    margin-bottom: 5px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .buttons-container button {
    margin: 10px 0;
    padding-left: 20px;
    padding-right: 20px;
  }

  .simulation-time-container {
    margin-top: 1px;
    padding: 12px;
    background-color: #F3F4F6;
    border: 2px solid black;
    border-radius: 10px;         
    margin-bottom: 15px;         
    display: inline-block;      
    box-shadow: 2px 2px 0px black; 
    font-size: 1.3em;
  }

  .simulation-time-container label {
    display: block;
    margin-bottom: 0px;
    font-family: 'Press Start 2P', cursive;
    font-size: 0.7em;
  }

  .simulation-time-container input {
    padding: 6px;
    font-family: 'Press Start 2P', cursive;
    font-size: 0.7em;
    width: 60px;
    text-align: center;
    border: 1px solid #ccc;
    border-radius: 5px;
  }

  .footer-card {
    margin-top: 1px;
    margin-bottom: 10px;
    padding-left: 50px;
    padding-right: 50px;
    padding-top: 5px;
    padding-bottom: 12px;
    background-color: #F3F4F6;
    border: 2px solid black;
    border-radius: 10px;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    font-size: 0.8em;
    width: 88%;
    max-width: 390px;
    text-align: center;
  }

  .coffee-button {
    height: 50px;
    width: 181px;
    border-radius: 10px;
    overflow:hidden;
    border: 1px solid black;
    box-shadow: 2px 2px 0px black;
    display: block;
    margin: 0 auto;
  }

  .counter-container {
    margin-top: 15px;
  }


</style>

<!-- Link to Press Start 2P font -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">

<div class="app">

  <div class="header-card">
    <!-- Wrapped the header in a card-like container -->
    <div class="header-container">
      <h1>Can You Beat The Market?</h1>
    </div>
    <!-- Inline style binding for portfolio color -->
    <div 
      class="portfolio" 
      style="color: {portfolioColor};"
    >
      Portfolio Value <br>
      ${portfolio.portfolioValue.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}
    </div>
    <button class="help-icon" on:click={toggleHelp} aria-label="Help">
      {isHelpVisible ? "Hide Help" : "Show Help"}
    </button>
    {#if isHelpVisible}
    <div class="help-description-container">
      <div class="help-description">
        <p>
        Outperform a buy-and-hold investment strategy by timing your trades in a simulated market</p>
        <ol>
          <li>Simulation: Five years in 30 seconds using a rolling average of a positively biased geometric brownian motion.</li>
          <li>Trade: Use the 'Buy' and 'Sell' buttons to manage an all-in position in the market.</li>
          <li>Results: See how your timed trades compare to a simple buy-and-hold position.</li>
        </ol>
      </div>
    </div>
  {/if}
  </div>
  
  <div class="chart-container">
    <div class="timer">Time Left: {timer} seconds</div>
    <MarketChart />
  </div>
  
  {#if !simulationRunning && !simulationEnded}
    <div class="buttons-container">
      <button class="start" on:click={startSimulationHandler}>
        Start Simulation
      </button>
    </div>
    <div class="simulation-time-container">
      <label for="simTime">Timer Length</label>
      <input
        type="number"
        id="simTime"
        min="1"
        bind:value={simulationTime}
        on:change={handleSimulationTimeChange}
      />
    </div>
  {/if}
  
  {#if simulationRunning}
    <Controls on:buy={handleBuy} on:sell={handleSell} />
    <div class="buttons-container">
      <button class="stop" on:click={endSimulation}>Stop</button>
    </div>
  {/if}
  
  {#if simulationEnded}
    <!-- finalComparison already includes the buyHoldColor -->
    <div class="results">
      {@html finalComparison}
    </div>
    <div class="buttons-container">
      <button on:click={restartSimulation}>Restart</button>
    </div>
  {/if}

  <div class="footer-card">
    <div class="p">
      <p>Made by Collin</p>
    </div>
    {#if simulationEnded}
    <a
      href="https://www.buymeacoffee.com/B4Aaol3SrI"
      target="_blank"
      rel="noopener noreferrer"
      class="coffee-button"
    >
      <img
        src={coffeeButton}
        alt="Buy Me A Coffee"
        style="height: 50px; width: 181px;"
      />
    </a>
    {/if}
    <div class="counter-container">
      <retro-counter></retro-counter>
    </div>
  </div>

</div>