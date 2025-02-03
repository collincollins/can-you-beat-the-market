<!-- src/App.svelte -->

<script>
  // Import necessary Svelte lifecycle functions and components
  import { onMount, onDestroy } from 'svelte';
  import MarketChart from './components/MarketChart.svelte';
  import ExcessCagrVsTradingActivity from './components/ExcessCagrVsTradingActivity.svelte';
  import Controls from './components/Controls.svelte';
  import UsernameModal from './components/UsernameModal.svelte';

  // Import simulation functions and shared state stores
  import { startSimulation, stopSimulation, buyShares, sellShares } from './logic/simulation';
  import { userPortfolio, marketData, highScore, consecutiveWins } from './logic/store';
  import { fetchHighScore, updateHighScore } from './logic/highScoreService';
  import { setSimulationParams, getSimulationParams } from './logic/simulationConfig';
  
  // Import additional assets and bridges
  import './bridges/RetroCounterWrapper.jsx';
  import coffeeButton from '../src/assets/buy-me-a-coffee-button.png';

  /* -------------------------------------------------------------------------
     SIMULATION SETTINGS & STATE VARIABLES
     ------------------------------------------------------------------------- */
  // Timer input and countdown state (in seconds)
  let timerInput = 30;          // Default simulation duration (seconds)
  let timer = timerInput;       // Current timer value
  let simulationEnded = false;  // True if simulation has ended
  let simulationValid = false;  // True if simulation met the minimum duration criteria
  let simulationRunning = false;// True while simulation is active
  let finalComparison = '';     // HTML string to display buy-and-hold comparison result
  let timerInterval;            // Reference to the interval used for countdown
  let showModal = false;        // Controls visibility of the UsernameModal (for high score submission)
  let restartDisabled = false;  // Controls whether the restart button is temporarily disabled
  let slowMo = false;           // Indicates if the simulation is running in slow-motion mode

  // User portfolio and market data initialization
  let portfolio = { shares: 1, cash: 0, portfolioValue: 0 };
  let data = { days: [], marketPrices: [], rollingAverages: [], actions: [] };

  // Toggle for showing the help section in the UI
  let isHelpVisible = false;

  // Annualized return values for user and buy-and-hold strategy (in percent)
  let userAnnualReturn = 0;
  let buyHoldAnnualReturn = 0;

  // Final value of the buy-and-hold strategy
  let buyHoldFinal = 0;

  // Colors for displaying portfolio and buy-and-hold values in the header
  let portfolioColor = 'black';
  let buyHoldColor = 'black';

  // High score state from the database
  let currentHighScore = 0;     // Best win streak found in the DB
  let highScorePlayer = 'No one yet';
  let consecutiveWinsValue = 0; // User's local win streak for this session

  // Visitor Document ID used to update the visitor record in MongoDB
  let visitorDocId = null;

  let excessCagrCanvas;
  
  let visitorData = [];
  let userGame = null;

  /* -------------------------------------------------------------------------
     STORE SUBSCRIPTIONS
     ------------------------------------------------------------------------- */
  // Local references for unsubscribing from Svelte stores when the component is destroyed
  let unsubscribePortfolio;
  let unsubscribeMarketData;
  let unsubscribeHighScore;
  let unsubscribeConsecutiveWins;

  // Track simulation start time (for duration calculations)
  let simulationStartTime = null;

  // Computed properties for enabling/disabling buy/sell actions
  $: canBuy = portfolio.cash > 0;
  $: canSell = portfolio.shares > 0;

  // Subscribe to Svelte stores reactively
  $: portfolio = $userPortfolio;
  $: data = $marketData;
  $: currentHighScore = $highScore.score;
  $: highScorePlayer = $highScore.playerName;
  $: consecutiveWinsValue = $consecutiveWins;

  /* -------------------------------------------------------------------------
     COFFEE CLICK LOGGING (for analytics)
     ------------------------------------------------------------------------- */
  // Log a "coffee click" event using either the Beacon API or a fetch call.
  async function logCoffeeClick() {
    const payload = JSON.stringify({ timestamp: new Date().toISOString() });
    const url = '/.netlify/functions/logCoffeeClick';

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true // ensures request completion during page unload
        });
      } catch (error) {
        console.error('Error logging coffee click:', error);
      }
    }
  }

  // Handler for the coffee button click; logs the click then redirects
  function handleCoffeeClick(event) {
    event.preventDefault();
    logCoffeeClick();
    setTimeout(() => {
      window.location.href = 'https://www.buymeacoffee.com/B4Aaol3SrI';
    }, 100);
  }

  /* -------------------------------------------------------------------------
     LIFECYCLE: onMount
     ------------------------------------------------------------------------- */
  onMount(async () => {
    // 1. Create a new visitor document on page load for tracking session data.
    try {
      const response = await fetch('/.netlify/functions/createVisitorDocument', { method: 'POST' });
      const result = await response.json();
      if (result.documentId) {
        visitorDocId = result.documentId;
        localStorage.setItem('visitorDocId', visitorDocId);
        console.log('Visitor document successfully created.');
      }
    } catch (error) {
      console.error('Error creating visitor document:', error);
    }

    // 2. Fetch the current high score from the database and update the store.
    const hs = await fetchHighScore();
    highScore.set({ score: hs.score, playerName: hs.playerName });

    // 3. Set up subscriptions to shared stores to react to changes.
    unsubscribePortfolio = userPortfolio.subscribe(value => { portfolio = value; });
    unsubscribeMarketData = marketData.subscribe(value => { data = value; });
    unsubscribeHighScore = highScore.subscribe(value => {
      currentHighScore = value.score;
      highScorePlayer = value.playerName;
    });
    unsubscribeConsecutiveWins = consecutiveWins.subscribe(value => {
      consecutiveWinsValue = value;
    });

    // Now create the chart
    const res = await fetch('/.netlify/functions/getVisitorDocuments');
    visitorData = await res.json();
  });
  

  /* -------------------------------------------------------------------------
     LIFECYCLE: onDestroy
     ------------------------------------------------------------------------- */
  onDestroy(() => {
    // Unsubscribe from all store subscriptions
    if (unsubscribePortfolio) unsubscribePortfolio();
    if (unsubscribeMarketData) unsubscribeMarketData();
    if (unsubscribeHighScore) unsubscribeHighScore();
    if (unsubscribeConsecutiveWins) unsubscribeConsecutiveWins();
    // Stop simulation and clear any active timers
    stopSimulation();
    if (timerInterval) clearInterval(timerInterval);
  });

  /* -------------------------------------------------------------------------
     HELPER FUNCTIONS
     ------------------------------------------------------------------------- */
  // Toggle the visibility of the help section
  function toggleHelp() {
    isHelpVisible = !isHelpVisible;
  }

  // Handle submission of the username in the high score modal
  async function handleUsernameSubmit(event) {
    const playerName = event.detail;
    if (typeof playerName !== 'string' || playerName.trim() === '') {
      alert('Invalid player name. Please try again.');
      return;
    }

    // Update the high score in the database with the current win streak
    const success = await updateHighScore(playerName.trim(), consecutiveWinsValue);
    if (success) {
      // Immediately fetch and update the high score store with the new record
      const updatedHighScore = await fetchHighScore();
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

  /* -------------------------------------------------------------------------
     SIMULATION START HANDLER
     ------------------------------------------------------------------------- */
  async function startSimulationHandler() {
    // Initialize simulation state
    simulationEnded = false;
    simulationValid = false;
    simulationRunning = true;
    
    // Base configuration for simulation (30 real seconds represent 5 simulated years)
    const baseRealTimeSeconds = 30;
    const baseSimulationYears = 5;

    // Calculate the simulation duration in years proportional to user input
    const ratio = timerInput / baseRealTimeSeconds;
    const simulationDurationYears = baseSimulationYears * ratio;

    // Adjust parameters if slow-motion is active
    const adjustedTimerInput = slowMo ? timerInput * 2 : timerInput;
    const adjustedStepsPerSecond = slowMo ? 5 : 10;

    // Set timer based on adjusted input
    timer = adjustedTimerInput;

    // Record the simulation start time for duration calculation
    simulationStartTime = Date.now();

    // Reset header colors and comparison display at simulation start
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';

    // Reset annual return calculations and buy-and-hold final value
    userAnnualReturn = 0;
    buyHoldAnnualReturn = 0;
    buyHoldFinal = 0;

    // Update simulation parameters (real-time duration, simulation years, steps per second)
    setSimulationParams({
      simulationRealTimeSeconds: adjustedTimerInput,
      simulationDurationYears: simulationDurationYears,
      stepsPerSecond: adjustedStepsPerSecond,
    });

    // Start the simulation process (this function runs the simulation logic)
    startSimulation();

    // Set up a 1-second interval to count down the timer and trigger simulation end
    const intervalDuration = 1000; // milliseconds
    timerInterval = setInterval(() => {
      timer -= 1;
      if (timer <= 0) {
        endSimulation();
      }
    }, intervalDuration);
  }

  /* -------------------------------------------------------------------------
     SIMULATION END HANDLER
     ------------------------------------------------------------------------- */
     async function endSimulation() {

  // 9. Temporarily disable the restart button to prevent rapid re-clicks.
  restartDisabled = true;
  setTimeout(() => {
    restartDisabled = false;
  }, 1000);

  // 1. Stop the simulation.
  simulationEnded = true;
  simulationRunning = false;
  stopSimulation();

  // Clear the countdown timer.
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // 2. Compute simulation duration and validity.
  const simulationEndTime = Date.now();
  const durationInSeconds = (simulationEndTime - simulationStartTime) / 1000;
  const endedNaturally = timer <= 0;
  const minimumRequiredSeconds = slowMo ? 15 : 30;
  const simulationValidFlag = durationInSeconds >= minimumRequiredSeconds;
  simulationValid = simulationValidFlag;

  // 3. Compute final portfolio values and returns if market data is available.
  let portfolioVal = 0;
  if (data.marketPrices.length > 0) {
    buyHoldFinal = parseFloat(data.marketPrices[data.marketPrices.length - 1].toFixed(2));
    portfolioVal = parseFloat(portfolio.portfolioValue.toFixed(2));

    const totalDays = data.days[data.days.length - 1] || 1; // safeguard division by zero
    const initialValue = 100; // assumed starting value

    userAnnualReturn = ((portfolioVal / initialValue) ** (365 / totalDays) - 1) * 100;
    buyHoldAnnualReturn = ((buyHoldFinal / initialValue) ** (365 / totalDays) - 1) * 100;

    // Set colors based on performance.
    if (portfolioVal > buyHoldFinal) {
      portfolioColor = '#008b02'; // green
      buyHoldColor = '#f44336';   // red
    } else if (portfolioVal < buyHoldFinal) {
      portfolioColor = '#f44336'; // red
      buyHoldColor = '#008b02';   // green
    } else {
      portfolioColor = 'black';
      buyHoldColor = 'black';
    }

    // Prepare the final comparison HTML.
    finalComparison = `
      <span style="color: ${buyHoldColor};">
        Buy-and-Hold Value<br>
        $${buyHoldFinal.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </span>
    `;
  }

  // 4. If the simulation is valid, build the userGame object.
  if (simulationValid) {
    userGame = {
      buys: data.actions.filter(action => action.type === 'buy').length,
      sells: data.actions.filter(action => action.type === 'sell').length,
      portfolioCAGR: userAnnualReturn,
      buyHoldCAGR: buyHoldAnnualReturn
    };
  } else {
    userGame = null;
  }

  // 5. Build the payload and send the POST update.
  const storedVisitorDocId = visitorDocId || localStorage.getItem('visitorDocId') || "visitor_placeholder";
  const postUpdatePayload = {
    documentId: storedVisitorDocId,
    hasStarted: true,
    naturalEnd: endedNaturally,
    valid: simulationValidFlag,
    win: simulationValidFlag && (portfolioVal > buyHoldFinal),
    winStreak: simulationValidFlag ? (consecutiveWinsValue + (portfolioVal > buyHoldFinal ? 1 : 0)) : 0,
    endGameDate: new Date(simulationEndTime),
    durationOfGame: durationInSeconds,
    portfolioValue: portfolio ? portfolio.portfolioValue : 0,
    buyHoldFinalValue: buyHoldFinal,
    portfolioCAGR: userAnnualReturn,
    buyHoldCAGR: buyHoldAnnualReturn,
    buys: data.actions.filter(action => action.type === 'buy').length,
    sells: data.actions.filter(action => action.type === 'sell').length
  };

  try {
    const resUpdate = await fetch('/.netlify/functions/updateVisitorDocument', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postUpdatePayload)
    });
    const updateResult = await resUpdate.json();
    console.log(updateResult.message);
  } catch (error) {
    console.error('Error updating visitor document:', error);
  }

  // 6. Fetch the visitor documents once (to include the user’s data indirectly via the update).
  try {
    const res = await fetch('/.netlify/functions/getVisitorDocuments');
    visitorData = await res.json();
  } catch (error) {
    console.error('Error fetching visitor documents:', error);
  }

  // 7. Update win streak logic.
  let streakForUpdate = consecutiveWinsValue;
  if (!simulationValidFlag) {
    streakForUpdate = 0;
    consecutiveWins.set(0);
    console.log(`Simulation invalid (duration: ${durationInSeconds.toFixed(2)}s). Resetting consecutive wins to 0.`);
  } else {
    // Only update the streak if the portfolio outperformed buy-and-hold.
    if (portfolioVal > buyHoldFinal) {
      streakForUpdate = consecutiveWinsValue + 1;
      consecutiveWins.set(streakForUpdate);
      console.log(`Consecutive Wins increased to: ${streakForUpdate}`);

      // Fetch the current high score.
      const newestDBRecord = await fetchHighScore();
      console.log('Fetched current DB high score:', newestDBRecord);

      if (streakForUpdate > newestDBRecord.score) {
        showModal = true;
      }
    } else {
      streakForUpdate = 0;
      consecutiveWins.set(0);
      console.log('Consecutive Wins reset to 0 (performance not sufficient).');
    }
  }

  // Only update the high score store if the modal is not shown.
  if (!showModal) {
    try {
      const updatedHighScore = await fetchHighScore();
      highScore.set({
        score: updatedHighScore.score,
        playerName: updatedHighScore.playerName,
      });
      if (streakForUpdate > updatedHighScore.score) {
        console.log('Updated high score store with:', updatedHighScore);
      }
    } catch (error) {
      console.error('Error fetching updated high score:', error);
    }
  }

}

  /* -------------------------------------------------------------------------
     SIMULATION RESTART HANDLER
     ------------------------------------------------------------------------- */
  function restartSimulation() {
    // Reset simulation flags and default settings
    simulationEnded = false;
    simulationValid = false;
    simulationRunning = false;

    // Reset timer and slow-motion state to defaults
    timerInput = 30;
    timer = timerInput;
    slowMo = false;

    // Reset header colors and comparison display
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';

    // Reset computed annual returns and buy-and-hold values
    userAnnualReturn = 0;
    buyHoldAnnualReturn = 0;
    buyHoldFinal = 0;
    userGame = null;

    // Reset market data and user portfolio to their initial states
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
    // Note: Do not reset consecutiveWins here so that the win streak persists if appropriate

    // Create a new visitor document for the new game session
    fetch('/.netlify/functions/createVisitorDocument', { method: 'POST' })
      .then(response => response.json())
      .then(result => {
        if (result.documentId) {
          visitorDocId = result.documentId;
          localStorage.setItem('visitorDocId', visitorDocId);
          console.log('Visitor document successfully created.');
        } else {
          console.error('Failed to create new visitor document.');
        }
      })
      .catch(err => {
        console.error('Error creating new visitor document:', err);
      });
  }

  /* -------------------------------------------------------------------------
     EVENT HANDLERS FOR BUY/SELL CONTROLS
     ------------------------------------------------------------------------- */
  // Delegate buy action to simulation logic
  function handleBuy() {
    buyShares();
  }

  // Delegate sell action to simulation logic
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
  width: 93%;
  max-width: 700px;
  min-height: 293px;

  padding-left: 10px;
  padding-right: 0px;
  padding-top: 7px;
  padding-bottom: 0px;
}

.chart-container-excess {
  width: 93%;
  max-width: 700px;
  min-height: 300px;

  padding-left: 10px;
  padding-right: 0px;
  padding-top: 5px;
  padding-bottom: 7px;
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
      <button
        class="button restart"
        on:click={restartSimulation}
        disabled={restartDisabled}
        style="opacity: {restartDisabled ? 0.5 : 1}; touch-action: manipulation;">
        Restart
      </button>
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

    <div class="card" style="max-width: 200px; align-items: center; padding-bottom: 0px;">
      <h2>Statistics</h2>
    </div>

    <div class="chart-container-excess card">
     <ExcessCagrVsTradingActivity {visitorData} {userGame} />
    </div>

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
        on:click|preventDefault={handleCoffeeClick}
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