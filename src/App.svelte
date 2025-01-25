<script>
  import { onMount, onDestroy } from 'svelte';
  import MarketChart from './components/MarketChart.svelte';
  import Controls from './components/Controls.svelte';
  import { startSimulation, stopSimulation } from './logic/simulation';
  import { userPortfolio, marketData } from './logic/store';
  
  let simulationTime = 30;
  let timer = simulationTime;
  let timerInterval = null;
  let simulationEnded = false;
  let simulationRunning = false;
  let finalComparison = '';
  
  // action message for buy/sell indications
  let actionMessage = '';
  let actionTimeout = null;
  
  // user state
  let portfolio = { shares: 1, cash: 0, portfolioValue: 0 };
  let data = { days: [], marketPrices: [], actions: [] };
  
  // reactive statement to compute final comparison when simulation ends
  $: finalComparison = simulationEnded ? computeFinalComparison() : '';
  
  userPortfolio.subscribe(value => {
    portfolio = value;
  });
  
  marketData.subscribe(value => {
    data = value;
  });
  
  function computeFinalComparison() {
    if (data.marketPrices.length === 0) return '';
    // compute buy-and-hold based on initial shares (1) and final market price
    const buyHoldFinal = parseFloat((1 * data.marketPrices[data.marketPrices.length - 1]).toFixed(2));
    const userFinal = parseFloat(portfolio.portfolioValue.toFixed(2));

    const formattedUserFinal = userFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedBuyHoldFinal = buyHoldFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `<p>Your final value: $${formattedUserFinal}</p><p>Buy-and-Hold: $${formattedBuyHoldFinal}</p>`;
}
  
  onMount(() => {
    // no automatic start; we wait for "Start Simulation" button
  });
  
  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
    stopSimulation();
    if (actionTimeout) clearTimeout(actionTimeout);
  });
  
  function startSimulationHandler() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    simulationEnded = false;
    simulationRunning = true;
    timer = simulationTime;
    startSimulation();
    
    timerInterval = setInterval(() => {
      timer -= 1;
      if (timer <= 0) {
        endSimulation();
      }
    }, 1000);
  }
  
  function endSimulation() {
    simulationEnded = true;
    simulationRunning = false;
    stopSimulation();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  
  function restartSimulation() {
    simulationEnded = false;
    simulationRunning = false;
    timer = simulationTime;
    
    // reset market data and user portfolio
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
    
    // ensure no active timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  
  // handlers for buy/sell events
  function handleBuy() {
    actionMessage = 'Bought Shares!';
    if (actionTimeout) clearTimeout(actionTimeout);
    actionTimeout = setTimeout(() => {
      actionMessage = '';
    }, 3000);
  }
  
  function handleSell() {
    actionMessage = 'Sold Shares!';
    if (actionTimeout) clearTimeout(actionTimeout);
    actionTimeout = setTimeout(() => {
      actionMessage = '';
    }, 3000);
  }
  
  // handle simulation time change
  function handleSimulationTimeChange(event) {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0) {
      simulationTime = value;
      timer = simulationTime;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      timerInterval = setInterval(() => {
        timer -= 1;
        if (timer <= 0) {
          endSimulation();
        }
      }, 1000);
    }
  }
</script>

<style>
  .app {
    font-family: 'Press Start 2P', cursive;
    text-align: center;
    padding: 10px;
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.8em;
  }

  .timer {
    font-size: 1.1em;
    margin: 5px 0;
  }
  
  .portfolio {
    font-size: 1.25em; 
    margin: 15px 0;
    color: #008b02;
  }

  .results {
    margin-top: 30px;
    padding: 12px;
    background-color: #008b022a;
    border: 2px solid black;
    border-radius: 10px;
    margin-bottom: 15px;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    font-size: 1.2em; 
    transition: all 0.3s ease;
  }
  
  .action-message {
    margin-top: 10px;
    font-size: 0.8em;
    color: #008b02;
  }

  button {
    font-family: 'Press Start 2P', cursive;
    background-color: #008bba;
    border: 2px solid black;
    color: white;
    padding: 10px 20px;
    text-align: center;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    border-radius: 10px;
    font-size: 1em;
    margin: 10px 5px;
    cursor: pointer;
  }
  
  .stop {
    background-color: #878282ae;
  }

  .buttons-container {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .buttons-container button {
    margin: 5px 0;
    padding: 12px;
  }

  .simulation-time-container {
  margin-top: 20px;
  padding: 12px;
  background-color: #008bba39;
  border: 2px solid black;
  border-radius: 10px;         
  margin-bottom: 15px;         
  display: inline-block;      
  box-shadow: 2px 2px 0px black; 
  font-size: 1.2em;
  transition: all 0.3s ease;
}

.simulation-time-container label {
  display: block;
  margin-bottom: 10px;
  font-family: 'Press Start 2P', cursive;
  font-size: 0.8em;
}

.simulation-time-container input {
  padding: 5px;
  font-family: 'Press Start 2P', cursive;
  font-size: 0.8em;
  width: 60px;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 5px;
}
</style>

<!-- link to Press Start 2P font -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">

<div class="app">
  <h1>Can You Beat The Market?</h1>
  <div class="timer">Time Left: {timer} seconds</div>
  <div class="portfolio">
    Portfolio Value: ${portfolio.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </div>
  
  <MarketChart />
  
  {#if !simulationRunning && !simulationEnded}
    <div class="buttons-container">
      <button class="start" on:click={startSimulationHandler}>Start Simulation</button>
    </div>
    <div class="simulation-time-container">
      <label for="simTime">Simulation Length (seconds):</label>
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
    
    {#if actionMessage}
      <div class="action-message">{actionMessage}</div>
    {/if}
  {/if}
  
  {#if simulationEnded}
    <div class="results">
      {@html finalComparison}
    </div>
    <div class="buttons-container">
      <button on:click={restartSimulation}>Restart</button>
    </div>
  {/if}
</div>