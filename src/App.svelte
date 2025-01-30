<!-- src/App.svelte -->

<script>
  import { onDestroy, onMount } from 'svelte';
  import MarketChart from './components/MarketChart.svelte';
  import Controls from './components/Controls.svelte';
  import { startSimulation, stopSimulation, buyShares, sellShares } from './logic/simulation';
  import { userPortfolio, marketData, highScore, consecutiveWins } from './logic/store';
  import { fetchHighScore, updateHighScore } from './logic/highScoreService';
  import { setSimulationParams, getSimulationParams } from './logic/simulationConfig';
  import './bridges/RetroCounterWrapper.jsx';
  import coffeeButton from '../src/assets/buy-me-a-coffee-button.png';
  import UsernameModal from './components/UsernameModal.svelte';

  // **Simulation Settings**
  let timerInput = 30;          // Initial timer input value (in seconds)
  let timer = timerInput;       // Current timer value (in seconds)
  let simulationEnded = false;  // Flag to indicate if simulation has ended
  let simulationValid = false;  // Flag to indicate if simulation was valid
  let simulationRunning = false;// Flag to indicate if simulation is running
  let finalComparison = '';     // HTML string for Buy-and-Hold comparison
  let timerInterval;            // Reference to the simulation timer interval
  let showModal = false;        // Flag to control the visibility of the UsernameModal

  // **Slowmo Toggle State**
  let slowMo = false;           // Flag to indicate if Slowmo is active

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

  // **High Score State** (from the DB)
  let currentHighScore = 0;     // The best streak found in the DB
  let highScorePlayer = 'No one yet';
  let consecutiveWinsValue = 0; // The user's local streak this session

  // **Store Subscriptions**
  let unsubscribePortfolio;
  let unsubscribeMarketData;
  let unsubscribeHighScore;
  let unsubscribeConsecutiveWins;

  // **Simulation Start Time Tracker**
  let simulationStartTime = null;

  // **Computed Props for Controls Component**
  $: canBuy = portfolio.cash > 0;
  $: canSell = portfolio.shares > 0;

  // Reactive variables automatically subscribe to the stores
  $: portfolio = $userPortfolio;
  $: data = $marketData;
  $: currentHighScore = $highScore.score;
  $: highScorePlayer = $highScore.playerName;
  $: consecutiveWinsValue = $consecutiveWins;

  // **Lifecycle Hooks**

  onMount(async () => {
    // Fetch the highest streak in DB at startup
    const hs = await fetchHighScore();
    highScore.set({ score: hs.score, playerName: hs.playerName });

    // Subscribe to stores and store the unsubscribe functions
    unsubscribePortfolio = userPortfolio.subscribe(value => {
      portfolio = value;
    });
    unsubscribeMarketData = marketData.subscribe(value => {
      data = value;
    });
    unsubscribeHighScore = highScore.subscribe(value => {
      currentHighScore = value.score;
      highScorePlayer = value.playerName;
    });
    unsubscribeConsecutiveWins = consecutiveWins.subscribe(value => {
      consecutiveWinsValue = value;
    });

    // **Visitor Counting Logic**
    try {
      const response = await fetch('/.netlify/functions/countVisitor', {
        method: 'POST',
      });

      const data = await response.json();
      if (data.isNewVisitor) {
        console.log('New visitor counted.');
      } else {
        console.log('Returning visitor.');
      }
    } catch (error) {
      console.error('Error counting visitor:', error);
    }
  });

  onDestroy(() => {
    // Clean up subscriptions and stop simulation when the component is destroyed
    if (unsubscribePortfolio) unsubscribePortfolio();
    if (unsubscribeMarketData) unsubscribeMarketData();
    if (unsubscribeHighScore) unsubscribeHighScore();
    if (unsubscribeConsecutiveWins) unsubscribeConsecutiveWins();

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

  async function handleUsernameSubmit(event) {
    const playerName = event.detail;
    console.log("Received playerName:", playerName, "Type:", typeof playerName);

    // Ensure playerName is a valid string
    if (typeof playerName !== 'string' || playerName.trim() === '') {
      alert('Invalid player name. Please try again.');
      return;
    }

    // Insert a new doc for this winning streak
    // Because setHighScore.js now always does insertOne
    const success = await updateHighScore(playerName.trim(), consecutiveWinsValue);
      if (success) {
        // RIGHT AFTER we insert to the DB, fetch the new top doc:
        const updatedHighScore = await fetchHighScore();
        // Now update Svelte's store with the *actual* top doc
        highScore.set({
          score: updatedHighScore.score,
          playerName: updatedHighScore.playerName,
        });
        console.log(`Updated local store with: ${updatedHighScore.playerName}, ${updatedHighScore.score}`);
      } else {
        alert('Failed to record your high score. Please try again.');
      }

      showModal = false;
    }

  async function startSimulationHandler() {
    // Initialize simulation state and start the simulation
    simulationEnded = false;
    simulationValid = false; // Reset simulation validity
    simulationRunning = true;
    
    // **Base Configuration**
    const baseRealTimeSeconds = 30; // Base real-time duration corresponding to 5 years
    const baseSimulationYears = 5;  // Base simulation duration in years

    // **Calculate the ratio based on user input**
    const ratio = timerInput / baseRealTimeSeconds;

    // **Determine the simulation duration in years (proportional)**
    const simulationDurationYears = baseSimulationYears * ratio;

    // **Adjust Timer and Steps Based on SlowMo**
    const adjustedTimerInput = slowMo ? timerInput * 2 : timerInput;
    const adjustedStepsPerSecond = slowMo ? 5 : 10; // Halve steps per second when Slowmo is active

    // **Set Timer**
    timer = adjustedTimerInput;

    // **Record the Start Time**
    simulationStartTime = Date.now();

    // Reset text colors to black at the start of each new run
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';

    // Reset annualized returns and buy-and-hold values
    userAnnualReturn = 0;
    buyHoldAnnualReturn = 0;
    buyHoldFinal = 0;

    // **Set Simulation Parameters**
    setSimulationParams({
      simulationRealTimeSeconds: adjustedTimerInput,      // Adjusted real-time duration
      simulationDurationYears: simulationDurationYears,   // Proportional simulation duration
      stepsPerSecond: adjustedStepsPerSecond,             // Adjusted steps per second
    });

    // Start the simulation
    startSimulation();

    // **Standardize Timer Countdown Interval**
    const intervalDuration = 1000; // 1 second

    timerInterval = setInterval(() => {
      timer -= 1;
      if (timer <= 0) {
        endSimulation();
      }
    }, intervalDuration);
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

  // **Calculate Simulation Duration**
  const simulationEndTime = Date.now();
  const durationInSeconds = (simulationEndTime - simulationStartTime) / 1000;

  // **Retrieve Current Simulation Parameters**
  const { simulationRealTimeSeconds } = getSimulationParams();

  // **Determine Minimum Required Duration**
  const minimumRequiredSeconds = simulationRealTimeSeconds / 2; // Original 30 seconds

  if (durationInSeconds >= minimumRequiredSeconds) { // Adjusted based on Slowmo
    // **Valid Simulation**
    simulationValid = true;

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
        consecutiveWins.set(newConsecutiveWins);
        console.log(`Consecutive Wins: ${newConsecutiveWins}`);

        // ** 1. Re-fetch the latest high score from the DB **
        const newestDBRecord = await fetchHighScore();
        console.log('Fetched current DB high score:', newestDBRecord);

        // ** 2. Compare new local streak to the freshly fetched global record **
        if (newConsecutiveWins > newestDBRecord.score) {
          // Only now do we prompt for the name
          showModal = true;
        }

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
  } else {
    // **Invalid Simulation**
    simulationValid = false;
    console.log(`Simulation ended early after ${durationInSeconds.toFixed(2)} seconds. High score not updated.`);
    consecutiveWins.set(0)

    if (data.marketPrices.length > 0) {
      // Calculate Buy-and-Hold final value
      buyHoldFinal = parseFloat(data.marketPrices[data.marketPrices.length - 1].toFixed(2));
      const portfolioVal = parseFloat(portfolio.portfolioValue.toFixed(2));

      // Determine performance and update colors
      if (portfolioVal > buyHoldFinal) {
        portfolioColor = '#008b02'; // Green for outperforming
        buyHoldColor = '#f44336';   // Red for underperforming
      } else if (portfolioVal < buyHoldFinal) {
        portfolioColor = '#f44336'; // Red for underperforming
        buyHoldColor = '#008b02';   // Green for outperforming
      } else {
        // Equal performance
        portfolioColor = '#008b02'; // Green
        buyHoldColor = '#008b02';   // Green
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
}

function restartSimulation() {
  // Reset the simulation to its initial state
  simulationEnded = false;
  simulationValid = false;
  simulationRunning = false;

  // **Reset timerInput to default (e.g., 30 seconds)**
  timerInput = 30;
  timer = timerInput;

  // **Reset SlowMo toggle to its default state (false)**
  slowMo = false;

  // Reset colors to black
  portfolioColor = 'black';
  buyHoldColor = 'black';
  finalComparison = '';

  // Reset annualized returns and buy-and-hold values
  userAnnualReturn = 0;
  buyHoldAnnualReturn = 0;
  buyHoldFinal = 0;

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
    buyShares();
  }

  function handleSell() {
    sellShares();
  }
</script>

<style>

/* Specific Adjustments */
/* Header Card Specific Styles */
.header-card {
  font-size: 1em;
  padding-top: 5px;
  width: 80%;
  max-width: 500px;
}

/* Help Icon Specific Styles */
.help-icon {
  font-size: 0.5em;
  padding: 8px;
}

/* Help Description Container Specific Styles */
.help-description-container {
  background-color: white;
  padding: 0px 15px;
  font-size: .6em;;
  border: 1px solid #000000;
  box-shadow: var(--shadow-light);
}

/* Portfolio Specific Styles */
.portfolio {
  font-size: 0.7em;
  background-color: white;
  margin-top: -4px;
  max-width: 230px;
}

/* Results Specific Styles */
.results {
  /* Additional specific styles can be added here if needed */
  font-size: 0.7em;
  background-color: white;
  margin-top: 0px;
  max-width: 230px;
}

/* Consecutive Wins Container Specific Styles */
.consecutive-wins-container {
  font-size: 0.8em;
  margin-top: 5px;
}

/* Chart Container Specific Styles */
.chart-container {
  width: 90%;
  max-width: 700px;
  min-height: 293px;

  padding-left: 10px;
  padding-right: 0px;
  padding-top: 7px;
  padding-bottom: 0px;
}

.timer-container input {
    padding: 2px;
    margin-left: -10px;
    margin-right: -5px;
    margin-bottom: 0px;
    background-color: #F3F4F6;
    font-family: 'Press Start 2P', cursive;
    font-size: 0.8em;
    width: 40px;
    border: 1px solid #ccc;
    border-radius: 5px;
   text-align: center;
  }

/* Buttons Container Specific Styles */
.buttons-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Results and High Score Container Specific Styles */
.results-details-card {
  width: 80%;
  max-width: 400px;
  font-size: 0.75em;
  padding-top: 5px;
  padding-bottom: 10px;
}

.high-score-card {
  padding-bottom: 0px;
}

/* Invalid Simulation Message Specific Styles */
.invalid-simulation-message {
  font-size: 0.60em;
  text-align: center;
  color: red;
}

.coffee-button {
  padding: 0;
  margin-bottom: 15px;
  touch-action: manipulation;
  height: 50px;
  width: 181px;
  overflow:hidden;
  }

  .counter-container {
  margin-bottom: 10px;
  }

  /* SlowMo Toggle Styles */
  .toggle-container {
    position: absolute;
    top: 5px;
    right: 12px;
    display: flex;
    align-items: center;
  }

  .toggle-label {
    margin-right: 8px;
    font-size: 0.8em;
  }

  .toggle {
    position: relative;
    width: 35px;
    height: 20px;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-background-dark);
    transition: 0.4s;
    border-radius: 8px;
    border: 1.1px solid #000000;
    box-shadow: var(--shadow-extra-light);
    outline: none !important;
  }

  .toggle, .slider {
  -webkit-user-select: none; /* Prevent text selection on iOS */
  -ms-user-select: none; /* Prevent text selection on IE/Edge */
  user-select: none; /* Prevent text selection on other browsers */
  -webkit-touch-callout: none; /* Disable callout (copy, etc.) on iOS */
}

  .slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 1.3px;
    bottom: 1.6px;
    background-color: white;
    transition: 0.4s;
    border-radius: 6px;
    border: 1.5px solid #000000;
  }

  .toggle input {
  -webkit-tap-highlight-color: transparent;
  opacity: 0;
  width: 0;
  height: 0;
  outline: none !important;
  box-shadow: none !important;
}

  .toggle input:checked + .slider {
    background-color: var(--color-button-default);
  }

  .toggle input:focus + .slider,
  .toggle input:active + .slider {
  box-shadow: none !important;
  outline: none !important;
  -webkit-tap-highlight-color: transparent;
  background-color: transparent;
}

  .toggle input:checked + .slider:before {
    transform: translateX(15px);
  }

  .toggle input:disabled + .slider {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Positioning the Slowmo Toggle */
.timer-slowmo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
}
</style>

<div class="app">

  <!-- Header Card -->
  <div class="card header-card">
    <!-- Wrapped the header in a card-like container -->
    <div class="header-container">
      <h1>Can You Beat The Market?</h1>
    </div>

    {#if simulationRunning || !simulationEnded}
      <div 
        class="card portfolio" 
        style="
          color: {portfolioColor};
          margin-bottom: 74px;
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
        class="card portfolio" 
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
      <div class="card results">
        {@html finalComparison}
      </div>
    {/if}

    <div>
      <button class="help-icon button start" on:click={toggleHelp} aria-label="Help">
        {isHelpVisible ? "Hide Help" : "Show Help"}
      </button>
    </div>

    {#if isHelpVisible}
      <div class="card help-description-container">
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

  <!-- Chart Container -->
  <div class="chart-container card">
    <!-- Timer and Slowmo Toggle -->
    <div class="timer-slowmo-container" style="margin-top: 2px">
      <div class="text-small timer-container">
        {#if !simulationRunning && !simulationEnded}
          <input
            type="number"
            min="10"
            bind:value={timerInput}
          /> 
          <span class="text-small">Seconds</span>
        {:else}
          <span class="text-small">{timer} Seconds</span>
        {/if}
      </div>
    
      <!-- Always show the Slowmo Toggle -->
      <div class="toggle-container">
        <span class="toggle-label" style="font-size: 0.5em;">
          {slowMo ? 'Slow' : 'Slow'}
        </span>
        <label class="toggle">
          <input 
            type="checkbox" 
            bind:checked={slowMo} 
            disabled={simulationRunning || simulationEnded} 
          />
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <div class="consecutive-wins-container">
      Win Streak: {consecutiveWinsValue}
    </div>

    <MarketChart />
  </div>

  <!-- Start Simulation Button -->
  {#if !simulationRunning && !simulationEnded}
    <div class="buttons-container">
      <button class="button start" on:click={startSimulationHandler}>
        Start Simulation
      </button>
    </div>
  {/if}

  <!-- Buy and Sell Controls -->
  {#if simulationRunning}
    <Controls {canBuy} {canSell} on:buy={handleBuy} on:sell={handleSell} />
    <div class="buttons-container">
      <button class="button stop" style="margin-top: 30px" on:click={endSimulation}>Stop</button>
    </div>
  {/if}

  <!-- Restart Simulation Button -->
  {#if simulationEnded}
    <div class="buttons-container">
      <button class="button restart" on:click={restartSimulation}>Restart</button>
    </div>
  {/if}

  <!-- Simulation Results Details -->
  {#if simulationEnded}
    <div class="card results-details-card" style="margin-top: 20px;">
      <h2>Simulation Results</h2>
      <p style="font-size: 0.90em;">
        Your Annual Return <br> {userAnnualReturn.toFixed(2)}%
      </p>
      <p style="font-size: 0.90em; margin-bottom: -15px">
        Buy-and-Hold Annual Return <br> {buyHoldAnnualReturn.toFixed(2)}%
      </p>
      <p>
        <br>
        {#if userAnnualReturn > buyHoldAnnualReturn}
          <span style="color: #008b02; margin-top: -20px; margin-bottom: 25px">
            You outperformed the buy-and-hold strategy
          </span>
        {:else if userAnnualReturn < buyHoldAnnualReturn}
          <span style="color: #f44336; margin-top: -20px; margin-bottom: 25px">
            You underperformed compared to the buy-and-hold strategy
          </span>
        {:else}
          <span style="color: #008b02; margin-top: -20px; margin-bottom: 25px">
            You matched the buy-and-hold strategy
          </span>
        {/if}
      </p>
      {#if simulationEnded && !simulationValid}
        <!-- Optional: Invalid Simulation Message -->
        <div class="invalid-simulation-message">
          Simulation did not run long enough to count towards win streak. Please run again for at least 30 seconds.
        </div>
      {/if}
    </div>
  {/if}

  <!-- High Score Display -->
  {#if simulationEnded}
    <div class="card results-details-card high-score-card">
      <h2>High Score</h2>
      <p>
        {highScorePlayer} has the most consecutive wins with {currentHighScore}
      </p>
      <p style="font-size: 6px;">
        Honorable mention to VladStopStalking with 6942069421 wins.
      </p>
    </div>
  {/if}

  <!-- Footer Card -->
  <div
    class="card footer-card {simulationRunning || !simulationEnded ? 'hidden-footer' : ''}"
  >
    <div>
      <p>Made by Collin</p>
    </div>
    {#if simulationEnded}
      <a
        href="https://www.buymeacoffee.com/B4Aaol3SrI"
        target="_blank"
        rel="noopener noreferrer"
        class="button coffee-button"
      >
        <img
          src={coffeeButton}
          alt="Buy Me A Coffee"
          style="height: 50px; width: 181px;"
        />
      </a>
    {/if}
    <div class="counter-container">
      <p style="margin-top: 10px; margin-bottom: 2px; font-size: 0.5em;">Visitors</p>
      <retro-counter></retro-counter>
    </div>
  </div>

  <!-- Username Modal for High Score Submission -->
  {#if showModal}
    <UsernameModal on:submit={handleUsernameSubmit} />
  {/if}

</div>