<!-- src/App.svelte -->

<script>
// ========================
// IMPORTS
// ========================
import {
    onMount,
    onDestroy
} from 'svelte';
import MarketChart from './components/MarketChart.svelte';
import ExcessCagrVsTradingActivity from './components/ExcessCagrVsTradingActivity.svelte';
import Sp500Chart from './components/Sp500Chart.svelte';
import Controls from './components/Controls.svelte';
import UsernameModal from './components/UsernameModal.svelte';
import LoginModal from './components/LoginModal.svelte';
import StatsPage from './components/StatsPage.svelte';
import LeaderboardCards from './components/LeaderboardCards.svelte';

// import simulation functions and shared state stores
import {
    startSimulation,
    stopSimulation,
    buyShares,
    sellShares,
    getCurrentRealMarketDates
} from './logic/simulation';
import {
    userPortfolio,
    marketData,
    highScore,
    consecutiveWins,
    sp500DataStore,
    visitorDataStore,
    precomputedChartDataStore,
    precomputedSp500ChartStore
} from './logic/store';
import {
    preComputeChartData
} from './logic/prepareChartData';
import {
    fetchAndPrepFullSp500
} from './logic/prepareSp500ChartData';
import {
    fetchHighScore,
    updateHighScore
} from './logic/highScoreService';
import {
    setSimulationParams
} from './logic/simulationConfig';

import {
    logCoffeeClick
} from './logic/analytics';

// additional assets and bridges
import './bridges/RetroCounterWrapper.jsx';
import coffeeButton from './assets/buy-me-a-coffee-button.png';

/* -------------------------------------------------------------------------
   SIMULATION SETTINGS & STATE VARIABLES
   ------------------------------------------------------------------------- */
// timer input and countdown state (in seconds)
let timerInput = 30; // default simulation duration (seconds)
let timer = timerInput; // current timer value
let simulationEnded = false; // true if simulation has ended
let simulationValid = false; // true if simulation met the minimum duration criteria
let simulationRunning = false; // true while simulation is active
let finalComparison = ''; // HTML string to display buy-and-hold comparison result
let timerInterval; // reference to the interval used for countdown
let showModal = false; // controls visibility of the UsernameModal (for high score submission)
let restartDisabled = false; // controls whether the restart button is temporarily disabled
let slowMo = false; // indicates if the simulation is running in slow-motion mode
let realMode = true;

// login/auth state
let showLoginModal = false;
let showStatsPage = false;
let currentUser = null; // {userId, username}
let visitorFingerprint = null; // store the hashed IP for linking sessions

// user portfolio and market data initialization
let portfolio = {
    shares: 1,
    cash: 0,
    portfolioValue: 0
};
let data = {
    days: [],
    marketPrices: [],
    rollingAverages: [],
    actions: []
};

let isHelpVisible = false; // toggle for showing the help section in the UI
// annualized return values for user and buy-and-hold strategy (in percent)
let userAnnualReturn = 0;
let buyHoldAnnualReturn = 0;
let buyHoldFinal = 0; // final value of the buy-and-hold strategy

// colors for displaying portfolio and buy-and-hold values in the header
let portfolioColor = 'black';
let buyHoldColor = 'black';

let currentHighScore = 0; // best win streak found in the DB
let highScorePlayer = 'No one yet';
let consecutiveWinsValue = 0; // user's local win streak for this session
let visitorDocId = null; // visitor document id used to update the visitor record in MongoDB
let resultNote = ''; // local variable that will be bound to the chart's resultNote;

// visitor and simulation data
let visitorData = [];
let sp500Data = []
let userGame = null;
let simulationStartDate = null;
let simulationEndDate = null;

// track simulation start time (for duration calculations)
let simulationStartTime = null;

// ========================
// STORE SUBSCRIPTIONS & REACTIVE STATEMENTS
// ========================
let unsubscribePortfolio;
let unsubscribeMarketData;
let unsubscribeHighScore;
let unsubscribeConsecutiveWins;

// subscribe to Svelte stores reactively
$: portfolio = $userPortfolio;
$: data = $marketData;
$: currentHighScore = $highScore.score;
$: highScorePlayer = $highScore.playerName;
$: consecutiveWinsValue = $consecutiveWins;

// subscribe to the store.
const unsubscribeSP500 = sp500DataStore.subscribe(value => {
    sp500Data = value;
});

// computed properties for buy/sell
$: canBuy = portfolio.cash > 0;
$: canSell = portfolio.shares > 0;

// ========================
// LIFECYCLE HOOKS
// ========================
onMount(async () => {
    // 0. Check if user is logged in and validate they still exist in the database
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            
            // Validate that the user still exists in the database
            const validateResponse = await fetch('/.netlify/functions/validateUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: parsedUser.userId })
            });
            
            const validateResult = await validateResponse.json();
            
            // If user doesn't exist, clear localStorage
            if (!validateResponse.ok || !validateResult.valid) {
                localStorage.removeItem('currentUser');
                currentUser = null;
            } else {
                currentUser = parsedUser;
            }
        } catch (e) {
            console.error('Error validating user:', e);
            localStorage.removeItem('currentUser');
            currentUser = null;
        }
    }

    // 1. create a new visitor document on page load for tracking session data.
    try {
        const response = await fetch('/.netlify/functions/createVisitorDocument', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser?.userId || null })
        });
        const result = await response.json();
        if (result.documentId) {
            visitorDocId = result.documentId;
            localStorage.setItem('visitorDocId', visitorDocId);
        }
        // Store visitorFingerprint from the session for later linking
        if (result.visitorFingerprint) {
            visitorFingerprint = result.visitorFingerprint;
        }
    } catch (error) {
        console.error('Error creating visitor document:', error);
    }

    // set up subscriptions to shared stores to react to changes.
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
});

onDestroy(() => {
    // clean up store subscriptions
    unsubscribePortfolio && unsubscribePortfolio();
    unsubscribeMarketData && unsubscribeMarketData();
    unsubscribeHighScore && unsubscribeHighScore();
    unsubscribeConsecutiveWins && unsubscribeConsecutiveWins();
    unsubscribeSP500 && unsubscribeSP500();

    // stop simulation and clear timer
    stopSimulation();
    timerInterval && clearInterval(timerInterval);
});

// ========================
// HELPER FUNCTIONS & EVENT HANDLERS
// ========================

function handleCoffeeClick(event) {
    event.preventDefault();
    logCoffeeClick();
    setTimeout(() => {
        window.location.href = 'https://www.buymeacoffee.com/B4Aaol3SrI';
    }, 100);
}

// toggle the visibility of the help section
function toggleHelp() {
    isHelpVisible = !isHelpVisible;
}

// handle submission of the username in the high score modal
async function handleUsernameSubmit(event) {
    const playerName = event.detail;
    if (typeof playerName !== 'string' || playerName.trim() === '') {
        alert('Invalid player name. Please try again.');
        return;
    }

    // update the high score in the database with the current win streak
    const success = await updateHighScore(playerName.trim(), consecutiveWinsValue);
    if (success) {
        // immediately fetch and update the high score store with the new record
        const updatedHighScore = await fetchHighScore();
        highScore.set({
            score: updatedHighScore.score,
            playerName: updatedHighScore.playerName,
        });
    } else {
        alert('Failed to record your high score. Please try again.');
    }
    showModal = false;
}

// simulation event handlers
async function startSimulationHandler() {
    // initialize simulation state
    simulationEnded = false;
    simulationValid = false;
    simulationRunning = true;

    // adjust parameters if slow-motion is active
    const adjustedTimerInput = slowMo ? timerInput * 2 : timerInput;
    const adjustedFrequency = slowMo ? 18 : 37;

    timer = adjustedTimerInput;
    simulationStartTime = Date.now();
    portfolioColor = 'black';
    buyHoldColor = 'black';
    finalComparison = '';
    userAnnualReturn = 0;
    buyHoldAnnualReturn = 0;
    buyHoldFinal = 0;

    setSimulationParams({
        simulationRealTimeSeconds: adjustedTimerInput,
        realMode: realMode,
        realMarketDataFrequency: adjustedFrequency
    });

    if (realMode || !slowMo) {
        // In real mode or if not slow-mo, use adjustedTimerInput for both.
        await startSimulation(adjustedTimerInput, realMode, adjustedFrequency, adjustedTimerInput);
    } else {
        // In simulated mode with slow-mo, pass the original timerInput for dataset generation.
        await startSimulation(adjustedTimerInput, realMode, adjustedFrequency, timerInput);
    }

    // set up a 1-second interval to count down the timer and trigger simulation end
    const intervalDuration = 1000; // milliseconds
    timerInterval = setInterval(() => {
        timer -= 1;
        if (timer <= 0) {
            endSimulation();
        }
    }, intervalDuration);

    // PRE-FETCH THE VISITOR DATA HERE
    try {
        const url = realMode ?
            '/.netlify/functions/getVisitorDocuments?realMode=true' :
            '/.netlify/functions/getVisitorDocuments?realMode=false';

        const res = await fetch(url);
        
        // Check if the response is successful
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        // Log cache information
        const cacheDate = res.headers?.get('X-Cache-Date');
        const cacheStatus = res.headers?.get('X-Cache-Status');
        if (cacheDate) {
            const dataAgeMinutes = Math.round((Date.now() - new Date(cacheDate).getTime()) / (1000 * 60));
            const refreshAtMinutes = 360; // 6 hours in minutes
            const mode = realMode ? 'Real Mode' : 'Simulated Mode';
            const timeUntilRefresh = refreshAtMinutes - dataAgeMinutes;
            const refreshMsg = timeUntilRefresh > 0 ? `Next refresh in ${timeUntilRefresh} min` : 'Refreshing now...';
            console.log(`Chart Data [${mode}]: ${dataAgeMinutes}/${refreshAtMinutes} min (${cacheStatus === 'MISS' ? 'REFRESHED' : 'cached'}) - ${refreshMsg}`);
        }
        
        const json = await res.json();
        
        // Validate that json is an array before proceeding
        if (!Array.isArray(json)) {
            throw new Error('Invalid data format: expected an array');
        }
        
        // store the result in visitorDataStore
        visitorDataStore.set(json);

        // PRE-COMPUTE CHART DATA, including regression, now
        const chartData = preComputeChartData(json);
        precomputedChartDataStore.set(chartData);

    } catch (error) {
        console.error('Error pre-fetching visitor documents:', error);
        // Set empty arrays as fallback to prevent further errors
        visitorDataStore.set([]);
        precomputedChartDataStore.set({
            cleanedData: [],
            meanData: [],
            regressionPoints: [],
            slope: 0,
            intercept: 0,
            slopeUncertainty: 0,
            yMin: 0,
            yMax: 0,
            xMin: 0,
            xMax: 0
        });
    }

    // PRE-FETCH S&P 500 DATA IN BACKGROUND (only in real mode, will be cached after first fetch)
    if (realMode) {
        try {
            const windowSize = 2;
            const spDataFull = await fetchAndPrepFullSp500(windowSize);
            precomputedSp500ChartStore.set(spDataFull);
        } catch (err) {
            console.error('Error fetching and preparing SP500 data:', err);
        }
    }
}

async function endSimulation() {

    // stop the simulation.
    simulationEnded = true;
    simulationRunning = false;
    stopSimulation();

    // temporarily disable the restart button to prevent rapid re-clicks.
    restartDisabled = true;
    setTimeout(() => {
        restartDisabled = false;
    }, 1000);

    // 1. clear the countdown timer.
    timerInterval && clearInterval(timerInterval);

    if (realMode) {
        const currentDates = getCurrentRealMarketDates();
        if (currentDates) {
            simulationStartDate = currentDates.startRealMarketDate;
            simulationEndDate = currentDates.endRealMarketDate;
        } else {
            console.warn("Simulation dates not available yet.");
        }
    }

    let realMarketDates = null;
    if (realMode) {
        realMarketDates = {
            startRealMarketDate: simulationStartDate,
            endRealMarketDate: simulationEndDate
        };
    }

    // 2. compute simulation duration and validity.
    const simulationEndTime = Date.now();
    const durationInSeconds = (simulationEndTime - simulationStartTime) / 1000;
    const endedNaturally = timer <= 0;
    const minimumRequiredSeconds = slowMo ? 20 : 10;
    const simulationValidFlag = durationInSeconds >= minimumRequiredSeconds;
    simulationValid = simulationValidFlag;

    // 3. compute final portfolio values and returns if market data is available.
    let portfolioVal = 0;
    if (data.marketPrices.length > 0) {
        buyHoldFinal = parseFloat(data.rollingAverages[data.rollingAverages.length - 1].toFixed(2));
        portfolioVal = parseFloat(portfolio.portfolioValue.toFixed(2));

        const totalDays = data.days[data.days.length - 1] || 1; // safeguard division by zero
        const initialValue = data.rollingAverages[0] || 100; // use the first smoothed value as the starting price

        userAnnualReturn = ((portfolioVal / initialValue) ** (365 / totalDays) - 1) * 100;
        buyHoldAnnualReturn = ((buyHoldFinal / initialValue) ** (365 / totalDays) - 1) * 100;

        // set colors based on performance.
        if (portfolioVal > buyHoldFinal) {
            portfolioColor = '#008b02'; // green
            buyHoldColor = '#f44336'; // red
        } else if (portfolioVal < buyHoldFinal) {
            portfolioColor = '#f44336'; // red
            buyHoldColor = '#008b02'; // green
        } else {
            portfolioColor = 'black';
            buyHoldColor = 'black';
        }

        //prepare the final comparison HTML.
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

    // 4. if the simulation is valid, build the userGame object.
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

    // 5. build the payload and send the POST update.
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
        sells: data.actions.filter(action => action.type === 'sell').length,
        realMode: realMode,
        ...(realMarketDates && {
            startRealMarketDate: realMarketDates.startRealMarketDate,
            endRealMarketDate: realMarketDates.endRealMarketDate
        })
    };

    // 5. send the update to MongoDB
    try {
        const resUpdate = await fetch('/.netlify/functions/updateVisitorDocument', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postUpdatePayload)
        });
        await resUpdate.json();
    } catch (error) {
        console.error('Error updating visitor document:', error);
        // Optionally, you might decide to abort further operations here.
        return;
    }

    // 7. update win streak logic.
    let streakForUpdate = consecutiveWinsValue;
    if (!simulationValidFlag) {
        streakForUpdate = 0;
        consecutiveWins.set(0);
        
        // Fetch high score to update display even when simulation is invalid
        try {
            const updatedHighScore = await fetchHighScore();
            highScore.set({
                score: updatedHighScore.score,
                playerName: updatedHighScore.playerName,
            });
        } catch (error) {
            console.error('Error fetching updated high score:', error);
        }
    } else {
        // only update the streak if the portfolio outperformed buy-and-hold.
        if (portfolioVal > buyHoldFinal) {
            streakForUpdate = consecutiveWinsValue + 1;
            consecutiveWins.set(streakForUpdate);

            // fetch the current high score once
            const newestDBRecord = await fetchHighScore();

            if (streakForUpdate > newestDBRecord.score) {
                showModal = true;
            } else {
                // Update high score store with fetched data (no need to fetch again)
                highScore.set({
                    score: newestDBRecord.score,
                    playerName: newestDBRecord.playerName,
                });
            }
        } else {
            streakForUpdate = 0;
            consecutiveWins.set(0);
            
            // Fetch high score to update display
            try {
                const updatedHighScore = await fetchHighScore();
                highScore.set({
                    score: updatedHighScore.score,
                    playerName: updatedHighScore.playerName,
                });
            } catch (error) {
                console.error('Error fetching updated high score:', error);
            }
        }
    }

}

/* -------------------------------------------------------------------------
   SIMULATION RESTART HANDLER
   ------------------------------------------------------------------------- */
function restartSimulation() {
    simulationEnded = false;
    simulationValid = false;
    simulationRunning = false;
    timerInput = 30;
    timer = timerInput;
    portfolioColor = 'black';
    buyHoldColor = 'black';
    visitorData = [];
    finalComparison = '';
    userAnnualReturn = 0;
    buyHoldAnnualReturn = 0;
    buyHoldFinal = 0;
    userGame = null;
    marketData.set({
        days: [],
        marketPrices: [],
        rollingAverages: [],
        actions: []
    });
    userPortfolio.set({
        shares: 1,
        cash: 0,
        portfolioValue: 0
    });
    // do not reset consecutiveWins here so that the win streak persists

    // create a new visitor document for the new game session
    fetch('/.netlify/functions/createVisitorDocument', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser?.userId || null })
        })
        .then(response => response.json())
        .then(result => {
            if (result.documentId) {
                visitorDocId = result.documentId;
                localStorage.setItem('visitorDocId', visitorDocId);
            } else {
                console.error('Failed to create new visitor document.');
            }
        })
        .catch(err => {
            console.error('Error creating new visitor document:', err);
        });
}

// buy/sell event delegation
function handleBuy() {
    buyShares();
}

function handleSell() {
    sellShares();
}

// login/signup handlers
function handleLoginClick() {
    showLoginModal = true;
}

async function handleLoginSubmit(event) {
    const { username, password, isSignup } = event.detail;
    
    try {
        if (isSignup) {
            // Create new user
            const response = await fetch('/.netlify/functions/createUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username,
                    password,
                    visitorFingerprint 
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                alert(error.message || 'Failed to create account');
                return;
            }
            
            const result = await response.json();
            currentUser = { userId: result.userId, username: result.username };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Link current session data to the new user
            if (visitorFingerprint) {
                await fetch('/.netlify/functions/linkSessionToUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: currentUser.userId,
                        visitorFingerprint 
                    })
                });
            }
            
            showLoginModal = false;
        } else {
            // Login existing user
            const response = await fetch('/.netlify/functions/loginUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const error = await response.json();
                alert(error.message || 'Login failed');
                return;
            }
            
            const result = await response.json();
            currentUser = { userId: result.userId, username: result.username };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Link current session data to the existing user
            if (visitorFingerprint) {
                await fetch('/.netlify/functions/linkSessionToUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: currentUser.userId,
                        visitorFingerprint 
                    })
                });
            }
            
            showLoginModal = false;
        }
    } catch (error) {
        console.error('Error during login/signup:', error);
        alert('An error occurred. Please try again.');
    }
}

function handleLoginClose() {
    showLoginModal = false;
}

// stats page handlers
function handleStatsClick() {
    showStatsPage = true;
}

function handleStatsClose() {
    showStatsPage = false;
}
</script>

<style>
/* specific adjustments */

.header-card {
    font-size: 1em;
    padding-top: 5px;
    width: 80%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
}

.help-icon {
    font-size: 0.5em;
    padding: 8px;
    margin-bottom: 0px;
}

.header-buttons-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 5px;
}

.help-description-container {
    background-color: white;
    padding: 0px 15px;
    font-size: .6em;
    ;
    border: 1px solid #000000;
    box-shadow: var(--shadow-light);
}

.portfolio {
    font-size: 0.7em;
    background-color: white;
    margin-top: -4px;
    max-width: 230px;
}

.results {
    font-size: 0.7em;
    background-color: white;
    margin-top: 0px;
    max-width: 230px;
}

.consecutive-wins-container {
    font-size: 0.8em;
    margin-top: 5px;
}

.chart-container {
    width: 93%;
    max-width: 700px;
    min-height: 293px;

    padding-left: 10px;
    padding-right: 0px;
    padding-top: 7px;
    padding-bottom: 0px;
    background-color: var(--color-pure-white);
}

.chart-container-excess {
    width: 93%;
    max-width: 700px;
    height: auto;

    padding-left: 10px;
    padding-right: 0px;
    padding-top: 5px;
    padding-bottom: 10px;
    background-color: var(--color-pure-white);
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

.buttons-container {
    display: flex;
    justify-content: center;
    align-items: center;
}

.results-details-card {
    width: 80%;
    max-width: 400px;
    font-size: 0.75em;
    padding-top: 5px;
    padding-bottom: 10px;
    background-color: var(--color-background-card);
}

.high-score-card {
    padding-bottom: 0px;
}

.invalid-simulation-message {
    font-size: 0.60em;
    text-align: center;
    color: red;
}

.coffee-button {
    padding: 0;
    margin-bottom: 15px;
    touch-action: manipulation;
    height: 40px;
    width: 239px;
    overflow: hidden;
}

.counter-container {
    margin-bottom: 10px;
}

.toggle-container {
    position: relative;
    margin-top: auto;
    margin-bottom: -30px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.toggle-label {
    margin: auto;
    font-size: 0.8em;
}

.toggle {
    position: relative;
    width: 50px;
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

.toggle,
.slider {
    -webkit-user-select: none;
    /* Prevent text selection on iOS */
    -ms-user-select: none;
    /* Prevent text selection on IE/Edge */
    user-select: none;
    /* Prevent text selection on other browsers */
    -webkit-touch-callout: none;
    /* Disable callout (copy, etc.) on iOS */
}

.slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 3px;
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

.toggle input:checked+.slider {
    background-color: var(--color-button-default);
}

.toggle input:focus+.slider,
.toggle input:active+.slider {
    box-shadow: none !important;
    outline: none !important;
    -webkit-tap-highlight-color: transparent;
    background-color: transparent;
}

.toggle input:checked+.slider:before {
    transform: translateX(27px);
}

.toggle input:disabled+.slider {
    opacity: 0.6;
    cursor: not-allowed;
}

.timer-slowmo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    position: relative;
}

.result-note {
    font-family: 'Press Start 2P', cursive;
    text-align: center;
    color: #353535;
    padding-left: 10px;
    padding-right: 25px;
}

.app {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
}

.new-feature {
    background-color: var(--color-success) !important;
    animation: pulse 2s ease-in-out infinite;
}

.new-feature:hover {
    background-color: #016101 !important;
    animation: none;
}

@keyframes pulse {
    0%, 100% {
        transform: scale(1);
        box-shadow: 2px 2px 0px black;
    }
    50% {
        transform: scale(1.05);
        box-shadow: 3px 3px 0px black;
    }
}

@media (max-width: 450px) {
  .leaderboard-card {
    margin-left: 15px;
    margin-right: 15px;
  }
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

    <!-- Always show the Slowmo Toggle -->
    <div class="toggle-container" style="margin-left: auto; margin-bottom: -35px">
      <span class="toggle-label" style="font-size: 0.5em; margin-bottom: 3px">
        {slowMo ? 'Slowmo' : 'Slowmo'}
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

    <!-- Always show the Slowmo Toggle -->
    <div class="toggle-container" style="margin-right: auto;">
      <span class="toggle-label" style="font-size: 0.5em; margin-bottom: 3px;">
        {realMode ? 'Real' : 'Real'}
      </span>
      <label class="toggle" style="align-items: left; ">
        <input 
          type="checkbox" 
          bind:checked={realMode} 
          disabled={simulationRunning || simulationEnded} 
        />
        <span class="slider"></span>
      </label>
    </div>

    <div class="header-buttons-container">
      {#if !currentUser}
        <button class="help-icon button start new-feature" on:click={handleLoginClick} aria-label="Login">
          Account
        </button>
      {:else}
        <button class="help-icon button start new-feature" on:click={handleStatsClick} aria-label="Stats">
          Stats
        </button>
      {/if}
      <button class="help-icon button start" on:click={toggleHelp} aria-label="Help">
        {isHelpVisible ? "Hide Help" : "Show Help"}
      </button>
    </div>

    {#if isHelpVisible}
      <div class="card help-description-container">
        <div class="help-description">
          <p>Can you outperform a buy-and-hold investment strategy by timing your trades in a simulated or real market?</p>
          <ol>
            <li>Simulation: Three years in 30 seconds using the rolling average of a positively biased geometric brownian motion.</li>
            <li>Real Market Data: Three years in 30 seconds using a randomly selected, date-blinded subset of the S&P 500.</li>
            <li>Trade: Use the 'Buy' and 'Sell' buttons to manage an all-in position in the market.</li>
            <li>Results: See how your timed trades compare to a simple buy-and-hold position.</li>
            <li>Statistics: See insights about your and others' performance and activity.</li>
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
      {#if realMode}
        <h2 style="margin-bottom: -3px;">Simulation Results</h2>
        <p style="font-size: 0.9em;">
          {new Date(simulationStartDate).toLocaleDateString(undefined, {month: 'long', year: 'numeric' })}
          to {new Date(simulationEndDate).toLocaleDateString(undefined, {month: 'long', year: 'numeric' })}
        </p>
      {:else}
        <h2>Simulation Results</h2>
      {/if}
      <div class="card" style="padding-left: 0px; padding-right: 0px; box-shadow: var(--shadow-extra-light); margin: ; margin-bottom: -10px; background-color: var(--color-pure-white);">
      <p style="font-size: 1.2em;">
        Your Annual Return <br> {userAnnualReturn.toFixed(2)}%
      </p>
      <p style="font-size: 1.2em;">
        Buy-and-Hold Annual Return <br> {buyHoldAnnualReturn.toFixed(2)}%
      </p>
    </div>
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
          Timer too short to count towards statistics.<br>Please play again for at least 10 seconds.
        </div>
      {/if}
    </div>
    {#if simulationEnded && realMode}
      <div class="chart-container-excess card">
        <Sp500Chart simulationStartDate={simulationStartDate} simulationEndDate={simulationEndDate}/>
      </div>
    {/if}
  {/if}

  <!-- High Score Display -->
  {#if simulationEnded}

    <div class="card" style="max-width: 300px; align-items: center; padding-bottom: 0px;">
      <h2 style="margin-bottom: 0px; margin-top: 0px;">Statistics</h2>
      {#if realMode}
        <p style="font-size: 0.8em;">(Real Market Data)</p>
      {:else}
        <p style="font-size: 0.8em;">(Simulated Market Data)</p>
      {/if}
    </div>

    <div class="chart-container-excess card">
     <ExcessCagrVsTradingActivity {visitorData} {userGame} bind:resultNote />
      <div>   
        {#if resultNote}
          <p class="result-note" style="font-size: 0.8em">{resultNote}</p>
        {/if}
      </div>
    </div>

    <!-- <div class="chart-container-excess card">
      <DistributionChart {visitorData} {userGame} bind:distributionNote />
       <div>   
         {#if distributionNote}
           <p class="result-note" style="font-size: 0.8em">{distributionNote}</p>
         {/if}
       </div>
     </div> -->

    <div class="card results-details-card high-score-card">
      <h2 style="margin-bottom: 0px; margin-top: 5px;">High Score</h2>
      <p>
        {highScorePlayer} has the most consecutive wins with {currentHighScore}
      </p>
    </div>

    <!-- Leaderboard Cards -->
    <div class="card leaderboard-card" style="max-width: 680px; padding: 15px;">
      <h2 style="margin-bottom: 10px; margin-top: 5px; text-align: center;">Leaderboard</h2>
      <LeaderboardCards {realMode} />
    </div>

  {/if}

  <!-- Footer Card -->
  <div
    class="card footer-card {simulationRunning || !simulationEnded ? 'hidden-footer' : ''}"
    style="text-align: center;"
    >
    <div>
      <p style="margin-top: 0px">Made by Collin</p>
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
          style="height: 40px; width: 239px;"
        />
      </a>
      <div style="font-size: 0.7em; color: 'black'; margin-top: -10px; margin-left: 50px; margin-right: 50px;">
        <sup>*</sup> <a href="https://dontbuythat.org" target="_blank" rel="noopener noreferrer" style="color: #435b9f; text-decoration: none;">Don't Buy That</a> coffee and see how much your money could grow into.
      </div>
    {/if}
    <div class="counter-container">
      <p style="margin-top: 50px; margin-bottom: 2px; font-size: 0.5em;">Visitors</p>
      <retro-counter></retro-counter>
    </div>
  </div>

  <!-- Username Modal for High Score Submission -->
  {#if showModal}
    <UsernameModal on:submit={handleUsernameSubmit} />
  {/if}

  <!-- Login/Signup Modal -->
  {#if showLoginModal}
    <LoginModal on:submit={handleLoginSubmit} on:close={handleLoginClose} />
  {/if}

  <!-- Stats Page -->
  {#if showStatsPage}
    <StatsPage {currentUser} onClose={handleStatsClose} />
  {/if}

</div>
