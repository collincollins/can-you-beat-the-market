<script>
  import { onDestroy, onMount } from 'svelte';
  import MarketChart from './components/MarketChart.svelte';
  import Controls from './components/Controls.svelte';
  import { startSimulation, stopSimulation } from './logic/simulation';
  import { userPortfolio, marketData, highScore, consecutiveWins } from './logic/store';
  import { fetchHighScore, updateHighScore } from './logic/highScoreService';
  import './bridges/RetroCounterWrapper.jsx';
  import coffeeButton from '../src/assets/buy-me-a-coffee-button.png';
  import UsernameModal from './components/UsernameModal.svelte';

  // **Simulation Settings**
  let timerInput = 30;          // Initial timer input value
  let timer = timerInput;       // Current timer value
  let simulationEnded = false;  // Flag to indicate if simulation has ended
  let simulationRunning = false;// Flag to indicate if simulation is running
  let finalComparison = '';     // HTML string for Buy-and-Hold comparison
  let timerInterval;            // Reference to the simulation timer interval
  let showModal = false;        // Flag to control the visibility of the UsernameModal

  // **User State**
  let portfolio = { shares: 1, cash: 0, portfolioValue: 0 };
  let data = { days: [], marketPrices: [], actions: [] };
  let isHelpVisible = false;    // Flag to control the visibility of the help section

  // **Annualized Returns**
  let userAnnualReturn = 0;
  let buyHoldAnnualReturn = 0;

  // **Buy-and-Hold Tracking**
  let buyHoldFinal = 0;          // Final Buy-and-Hold value
  let portfolioColor = 'black'; // Color for the portfolio value text
  let buyHoldColor = 'black';    // Color for the Buy-and-Hold value text

  // **High Score State**
  let currentHighScore = 0;
  let highScorePlayer = 'No one yet';
  let consecutiveWinsValue = 0; // Current consecutive wins count

  // **Computed Props for Controls Component**
  $: canBuy = portfolio.cash > 0;
  $: canSell = portfolio.shares > 0;

  // **Store Subscriptions**
  const unsubscribePortfolio = userPortfolio.subscribe(value => {
    portfolio = value;
  });

  const unsubscribeMarketData = marketData.subscribe(value => {
    data = value;
  });

  const unsubscribeHighScore = highScore.subscribe(value => {
    currentHighScore = value.score;
    highScorePlayer = value.playerName;
  });

  const unsubscribeConsecutiveWins = consecutiveWins.subscribe(value => {
    consecutiveWinsValue = value;
  });

  // **Lifecycle Hooks**

  onMount(async () => {
    // Fetch High Score when the app mounts
    const hs = await fetchHighScore();
    highScore.set({ score: hs.score, playerName: hs.playerName });
  });

  onDestroy(() => {
    // Clean up subscriptions and stop simulation when the component is destroyed
    unsubscribePortfolio();
    unsubscribeMarketData();
    unsubscribeHighScore();
    unsubscribeConsecutiveWins();
    stopSimulation();
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });

  // **Helper Functions**

  function toggleHelp() {
    // Toggle the visibility of the help section
    isHelpVisible = !isHelpVisible;
  }

  async function handleUsernameSubmit(playerName) {
    // Handle the submission of the username in the modal
    const success = await updateHighScore(playerName, consecutiveWinsValue);
    if (success) {
      highScore.set({ score: consecutiveWinsValue, playerName });
    } else {
      alert('Failed to update high score. Please try again.');
    }
    showModal = false;
  }

  async function startSimulationHandler() {
    // Initialize simulation state and start the simulation
    simulationEnded = false;
    simulationRunning = true;
    timer = timerInput;

    // Reset text colors to black at the start of each new run
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';

    // Start the simulation
    startSimulation();

    // Start the timer countdown
    timerInterval = setInterval(() => {
      timer -= 1;
      if (timer <= 0) {
        endSimulation();
      }
    }, 1000);
  }

  async function endSimulation() {
  // Terminate the simulation and process results
  simulationEnded = true;
  simulationRunning = false;
  stopSimulation();

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (data.marketPrices.length > 0) {
    // Calculate Buy-and-Hold final value
    buyHoldFinal = parseFloat(data.marketPrices[data.marketPrices.length - 1].toFixed(2));
    const portfolioVal = parseFloat(portfolio.portfolioValue.toFixed(2));

    // Determine performance and update colors
    if (portfolioVal > buyHoldFinal) {
      portfolioColor = '#008b02'; // Green for outperforming
      buyHoldColor = '#f44336';   // Red for underperforming

      // Compute the new consecutive wins value
      const newConsecutiveWins = consecutiveWinsValue + 1;

      // Check if the new streak exceeds the current high score
      if (newConsecutiveWins > currentHighScore) {
        showModal = true; // Trigger the UsernameModal
      }

      // Update the consecutiveWins store
      consecutiveWins.set(newConsecutiveWins);
      console.log(`Consecutive Wins: ${newConsecutiveWins}`);
    } else if (portfolioVal < buyHoldFinal) {
      portfolioColor = '#f44336'; // Red for underperforming
      buyHoldColor = '#008b02';   // Green for outperforming
      consecutiveWins.set(0);      // Reset streak
      console.log('Consecutive Wins reset to 0');
    } else {
      // Equal performance
      portfolioColor = '#008b02'; // Green
      buyHoldColor = '#008b02';   // Green
      consecutiveWins.set(0);      // Reset streak
      console.log('Consecutive Wins reset to 0');
    }

    // **Calculate Annualized Returns (CAGR)**
    const totalDays = data.days[data.days.length - 1] || 1; // Avoid division by zero
    const initialValue = 100; // Assumed initial portfolio value

    // User's CAGR
    userAnnualReturn = ((portfolioVal / initialValue) ** (365 / totalDays) - 1) * 100;

    // Buy-and-Hold CAGR
    buyHoldAnnualReturn = ((buyHoldFinal / initialValue) ** (365 / totalDays) - 1) * 100;

    // **Update finalComparison HTML**
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
    // Reset the simulation to its initial state
    simulationEnded = false;
    simulationRunning = false;
    timer = timerInput;

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
    // Note: Do not reset consecutiveWins here to preserve streak
  }

  // **Event Handlers for Buy/Sell Buttons**
  function handleBuy() {
    // Optional: Implement additional logic after a buy action if needed
  }

  function handleSell() {
    // Optional: Implement additional logic after a sell action if needed
  }
</script>

<style>
    .app {
      font-family: 'Press Start 2P', cursive;
      text-align: center;
      margin-top: -10px;
      padding-top: 5px;
      padding-left: 20px;
      padding-right: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 0.9em;
      padding-bottom: 0;
    }
  
    .header-container {
      position: relative;
      justify-content: center;
      margin-top: 12px;
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
      margin-top: -2px;
    }
  
    .help-description {
      font-family: "Player Start 2P";
      font-size: 7pt;
      text-align: left;
      max-width: 400px;
      padding-left: 5px;
      padding-right: 10px;
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
  
    .timer-container input {
      font-size: 0.7em;
      padding: 3px;
      margin-left: 0px;
      margin-right: -5px;
      margin-bottom: 0px;
      background-color: F3F4F6;
      font-family: 'Press Start 2P', cursive;
      font-size: 0.8em;
      width: 40px;
      border: 1px solid #ccc;
      border-radius: 5px;
      text-align: center;
    }
    
    .portfolio {
      margin-top: -6px;
      padding: 8px;
      background-color: #ffffff;
      border: 2px solid #000000;
      border-radius: 10px;
      margin-bottom: 8px;
      display: flex;
      margin-left: auto;
      margin-right: auto;
      justify-content: center;
      max-width: 250px;
      box-shadow: 1px 1px 0px #000000;
      font-size: 0.85em;
    }
  
    .results {
      margin-top: 0px;
      padding: 8px;
      background-color: #ffffff;
      border: 2px solid #000000;
      border-radius: 10px;
      margin-bottom: 8px;
      display: flex;
      margin-left: auto;
      margin-right: auto;
      justify-content: center;
      max-width: 250px;
      box-shadow: 1px 1px 0px #000000;
      font-size: 0.85em;
    }
  
    .consecutive-wins-container {
      color: #545454;
      margin-top: 0px;
      margin-bottom: 0px;
      padding-left: 20px;
      padding-right: 20px;
      padding-top: 5px;
      padding-bottom: 0;
      background-color: #F3F4F6;
      border-radius: 10px;
      display: inline-block;
      font-size: 0.7em; 
    }
  
    .chart-container {
      position: relative;
      background-color: #F3F4F6;
      height: 290px;
      width: 98%;
      max-width: 800px;
      margin-top: 0px;
      margin-bottom: 0px;
      padding-left: 10px;
      padding-right: 0px;
      padding-top: 5px;
      padding-bottom: 10px;
      border: 2px solid black;
      border-radius: 15px;
      box-shadow: 2px 2px 0px black;
    }
  
    button {
      font-family: 'Press Start 2P', cursive;
      touch-action: manipulation;
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
      background-color: #384d86;
  }
    
    .stop {
      background-color: #878282ae;
    }
  
    .buttons-container {
      align-items: center;
    }
  
    .buttons-container button {
      margin: 0px 0;
      padding-left: 20px;
      padding-right: 20px;
    }
  
    .footer-card {
      bottom: 0px;
      left: center;
      margin-top: 5px;
      margin-bottom: 10px;
      padding-left: 50px;
      padding-right: 50px;
      padding-top: 5px;
      padding-bottom: 15px;
      background-color: #F3F4F6;
      border: 2px solid black;
      border-radius: 10px;
      display: inline-block;
      box-shadow: 2px 2px 0px black;
      font-size: 0.8em;
      width: 65%;
      max-width: 300px;
      text-align: center;
    }

        /* New class to hide the footer */
    .hidden-footer {
      transform: translateX(0%) translateY(200%); /* Pushes the footer down by 100% of its height */
    }
  
    .coffee-button {
      touch-action: manipulation;
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
  
    .results-details-card {
      background-color: #F3F4F6;
      border: 2px solid black;
      border-radius: 10px;
      padding: 15px 20px;
      margin-top: 30px;
      margin-bottom: 10px;
      max-width: 450px;
      box-shadow: 2px 2px 0px black;
      font-size: 0.8em;
      text-align: left;
    }
  
    .results-details-card h2 {
      margin-top: 0px;
      margin-bottom: 5px;
      font-size: 1.2em;
      text-align: center;
      color: #3B518B;
    }
  
    .results-details-card p {
      font-size: 0.9em;
      margin: 2px 0;
      text-align: center;
    }
  
    .high-score-container {
      margin-top: 2px;
      padding: 12px 20px;
      background-color: #F3F4F6;
      border: 2px solid #000000;
      border-radius: 10px;
      display: inline-block;
      box-shadow: 2px 2px 0px black;
      font-size: 0.7em;
      width: 65%;
      max-width: 300px;
      text-align: center;
      margin-bottom: 10px;
    }
  
    .high-score-container h2 {
      margin-top: 0px;
      margin-bottom: 5px;
      color: #3B518B;
    }
  
    .high-score-container p {
      margin-top: 0px;
      margin-bottom: 5px;
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
      {#if simulationRunning || !simulationEnded}
        <div 
        class="portfolio" 
        style="
        color: {portfolioColor};
        margin-bottom: 72px;
        
        "
        >
        Your Portfolio Value <br>
        ${portfolio.portfolioValue.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}
        </div>
        {:else}
        <div 
        class="portfolio" 
        style="color: {portfolioColor};"
        >
        Your Portfolio Value <br>
        ${portfolio.portfolioValue.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}
        </div>
      {/if}
      {#if simulationEnded}
      <!-- finalComparison already includes the buyHoldColor -->
        <div class="results">
          {@html finalComparison}
        </div>
      {/if}
      <div>
        <button class="help-icon" on:click={toggleHelp} aria-label="Help">
          {isHelpVisible ? "Hide Help" : "Show Help"}
        </button>
      </div>
      {#if isHelpVisible}
      <div class="help-description-container">
        <div class="help-description">
          <p>Can you outperform a buy-and-hold investment strategy by timing your trades in a simulated market?</p>
          <ol>
            <li>Simulation: Five years in 30 seconds using a rolling average of a positively biased geometric brownian motion.</li>
            <li>Trade: Use the 'Buy' and 'Sell' buttons to manage an all-in position in the market.</li>
            <li>Results: See how your timed trades compare to a simple buy-and-hold position.</li>
          </ol>
          <ul>
            <li>Note: Annualized returns are calculated using the Compound Annual Growth Rate (CAGR) to account for compounding effects over time.</li>
          </ul>
        </div>
      </div>
    {/if}
    </div>
    
    <div class="chart-container">
      <div class="timer-container">
        {#if !simulationRunning && !simulationEnded}
          <span style="font-size: 0.7em;">Time Left:</span>
          <input
            type="number"
            min="10"
            bind:value={timerInput}
            /> 
          <span style="font-size: 0.7em;">seconds</span>
        {:else}
           <span style="font-size: 0.7em" >Time Left: {timer} seconds</span>
        {/if}
      </div>
      <div class="consecutive-wins-container">
        Win Streak: {consecutiveWinsValue}
      </div>
      <MarketChart />
    </div>
  
    {#if !simulationRunning && !simulationEnded}
      <div class="buttons-container" style="margin-top: 10px; margin-bottom: 10px">
        <button class="start" on:click={startSimulationHandler}>
          Start Simulation
        </button>
      </div>
    {/if}
    
    {#if simulationRunning}
      <!-- Pass canBuy and canSell as props to Controls.svelte -->
      <Controls {canBuy} {canSell} on:buy={handleBuy} on:sell={handleSell} />
      <div class="buttons-container">
        <button class="stop" on:click={endSimulation}>Stop</button>
      </div>
    {/if}
  
    {#if simulationEnded}
    <div class="buttons-container" style="margin-top: 10px">
      <button on:click={restartSimulation}>Restart</button>
    </div>
    {/if}
  
    {#if simulationEnded}
    <!-- Results Details Card -->
      <div class="results-details-card">
        <h2>Simulation Results</h2>
          <p>
            Your Annual Return <br> {userAnnualReturn.toFixed(2)}%
          </p>
          <p>
            Buy-and-Hold Annual Return <br> {buyHoldAnnualReturn.toFixed(2)}%
          </p>
        <p>
          <br>
            {#if userAnnualReturn > buyHoldAnnualReturn}
              <span style="color: #008b02;">You outperformed the buy-and-hold strategy</span>
            {:else if userAnnualReturn < buyHoldAnnualReturn}
            <span style="color: #f44336;">You underperformed compared to the buy-and-hold strategy</span>
            {:else}
              <span style="color: #008b02;">You matched the buy-and-hold strategy</span>
            {/if}
        </p>
      </div>
    {/if}
  
    {#if simulationEnded}
    <!-- High Score Display -->
    <div class="high-score-container">
      <h2>High Score</h2>
      <p>
        {highScorePlayer} has the most consecutive wins with {currentHighScore}.
      </p>
    </div>
    {/if}
    <div
    class="footer-card"
    class:hidden-footer={simulationRunning || !simulationEnded}>
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

    {#if showModal}
      <UsernameModal on:submit={handleUsernameSubmit} />
    {/if}

  </div>