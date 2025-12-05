[![Netlify Status](https://api.netlify.com/api/v1/badges/fb0513ca-dddd-4891-a9a2-934b0ce4f56b/deploy-status)](https://app.netlify.com/sites/canyoubeatthemarket/deploys)

# Can You Beat The Market?
A neo-brutalist simulation game that challenges you to time your trades and outperform a simple buy‐and‐hold strategy. Experience 3 years of market movements in just 30 seconds using either simulated data (positively biased geometric Brownian motion) or real historical S&P 500 data.

## Overview
This project is built with Svelte and bundled with Vite. It leverages Chart.js for real-time charting and Netlify serverless functions to handle backend operations including user authentication, personal statistics tracking, high score management, and visitor analytics.

## Site Statistics
- **33,500+** unique visitors across **449,000** sessions
- **353,000+** games played
- Processed **1,060,000+** years of market simulation in **5,200+** hours of playtime

## Key Features
- **Dual Market Modes**: Choose between simulated market data (geometric Brownian motion with 9% drift and 20% volatility) or real historical S&P 500 data with randomly selected, date-blinded periods.
- **Time Compression**: Experience 3 years of market movements in 30 seconds (10 seconds = 1 market year), with an optional slow-motion mode that doubles the duration.
- **Trading Mechanics**: Execute all-in buy and sell actions using on-screen controls (see ```src/components/Controls.svelte```). Trades execute at rolling average prices (10-day window) to smooth out volatility.
- **Performance Comparison**: Annualized returns (CAGR) of your trading strategy are compared against a passive buy-and-hold approach.
- **User Authentication**: Secure username + password system with bcrypt hashing. Users can play anonymously or create accounts to track stats across sessions.
- **Personal Stats Page**: Comprehensive statistics dashboard including:
  - Win rate and performance metrics (avg/best/worst excess returns)
  - Trading style classification (conservative/balanced/active)
  - Global percentile ranking vs all players
  - Cumulative stats (total time played, market time experienced, total trades)
  - Recent game history with win/loss tracking
- **Win Streaks & High Scores**: Consecutive wins are tracked, and setting a new high score prompts you to submit your name to the global leaderboard.
- **Real-Time Analytics**: Live charts showing your performance vs other players, with regression analysis of trading frequency vs returns.

## Code Structure

### Frontend Components
- ```src/App.svelte```: Main application component orchestrating simulation flow, user interactions, timer controls, and authentication state.
- ```src/components/MarketChart.svelte```: Live Chart.js visualization of market prices with buy/sell markers.
- ```src/components/Controls.svelte```: Buy and sell button controls during active simulations.
- ```src/components/StatsPage.svelte```: Personal statistics dashboard for logged-in users (full-screen overlay).
- ```src/components/LoginModal.svelte```: Authentication modal for login/signup with password validation.
- ```src/components/UsernameModal.svelte```: Modal for submitting names when setting new high scores.
- ```src/components/ExcessCagrVsTradingActivity.svelte```: Scatter plot showing trading activity vs performance with regression line.
- ```src/components/Sp500Chart.svelte```: Historical S&P 500 chart displayed after real-mode games.

### Simulation Logic
- ```src/logic/simulation.js```: MarketSimulation class implementing geometric Brownian motion and real data playback.
- ```src/logic/simulationConfig.js```: Centralized parameters (drift: 9%, volatility: 20%, time mapping: 10 seconds = 1 year).
- ```src/logic/store.js```: Svelte stores for reactive state (market data, portfolio, high scores, win streaks).
- ```src/logic/prepareChartData.js```: Pre-computes regression analysis for the excess CAGR chart.
- ```src/logic/prepareSp500ChartData.js```: Fetches and processes S&P 500 historical data with in-memory caching.

### Backend (Netlify Functions)
- **Authentication**: ```createUser.js```, ```loginUser.js```, ```validateUser.js```, ```checkUsername.js```
- **Game Tracking**: ```createVisitorDocument.js```, ```updateVisitorDocument.js```, ```getVisitorDocuments.js``` (with 6-hour caching)
- **User Stats**: ```getUserStats.js``` (with global stats caching), ```linkSessionToUser.js```, ```manualLinkGames.js```
- **High Scores**: ```setHighScore.js```, ```getHighScore.js```
- **Analytics**: ```getVisitorCount.js```, ```logCoffeeClick.js```
- **Optimization**: ```updateGlobalStats.js``` (manual global stats refresh)

## How It Works

### Simulation Flow
1. **Setup**: Set timer duration (default 30 seconds) and choose between real or simulated market mode
2. **Market Generation**: 
   - **Simulated Mode**: Generates 3 years (1095 days) of price data using geometric Brownian motion
   - **Real Mode**: Selects a random 3-year period from historical S&P 500 data
3. **Smoothing**: Applies 10-day rolling average to all prices for trade execution
4. **Playback**: Market prices update in real-time over the 30-second period
5. **Trading**: Buy/sell buttons execute all-in trades at the current rolling average price
6. **Comparison**: Calculates CAGR for both your portfolio and a buy-and-hold strategy

### Game End
- Timer expires or user clicks Stop
- Performance comparison displayed (your CAGR vs buy-and-hold)
- Win streaks increment if you beat buy-and-hold
- Valid games (≥10 seconds) count toward statistics
- Real mode games show the actual historical period traded (with dates revealed)

### Authentication & Stats
- Users can play anonymously or create accounts
- Logged-in users access comprehensive stats via the Stats button
- Anonymous game data can be retroactively linked to new accounts
- Global rankings updated from cached data (refreshed every 24 hours)

## Running the Project Locally
1. Clone the Repository:
   - Use: ```git clone <repository-url>```
2. Install Dependencies:
   - Navigate to the project directory and run: ```npm install```
3. Start the Development Server:
   - Run: ```npm run dev```
   - Open ```http://localhost:3000``` in your browser.
4. Run Tests:
   - Jest tests are located in the ```__tests__``` directory. Run: ```npm test```

## Deployment and Environment
- The project deploys on Netlify. Currently, you are working on the test-features branch, which is synced to a deploy preview. 
- The deploy preview writes to a canyoubeatthemarket-test MongoDB cluster that mirrors the structure of the production cluster.

## Database Optimization & Caching
To minimize MongoDB costs while maintaining data accuracy, the application implements a smart caching strategy:

### Cache Strategy
- **Chart Data Cache**: Refreshes every 6 hours
  - Stores pre-aggregated chart data for both real and simulated modes
  - First game after cache expiry triggers refresh, all others use cached data
  - Console logs show cache age: "Chart data from cache - Data age: X minutes"
  
- **Global Stats Cache**: Refreshes every 24 hours  
  - Stores global average excess CAGR and all returns for percentile calculations
  - Auto-updates on first stats page view after expiry
  - Console logs show: "Global stats data age: X hours"

### Database Indexes
Run the index creation script once after setting up MongoDB:
```bash
MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET=<your-connection-string> node scripts/createIndexes.cjs
```

This creates indexes on:
- `users.username` (unique, case-insensitive)
- `users.userId` (unique)
- `visitors.userId`
- `visitors.visitorFingerprint`
- `visitors.valid`
- `visitors.hasStarted`
- `visitors.valid + realMode` (compound)

### Query Optimization
All database queries use projections to fetch only required fields, reducing data transfer and processing costs by 30-40%.

## Technologies Used
- Svelte: UI framework. 
- Vite: Bundler and development server. 
- Chart.js: Charting library for visualizing data. 
- Jest: Testing framework for simulation logic and other functionalities. 
- Netlify Functions: Serverless backend functions for handling API requests. 
- MongoDB: NoSQL database for persistent storage (high scores, visitor counts, etc.).

## Contributing
Contributions are welcome!

## License
This project is open-source. See the LICENSE file for additional details.

## Acknowledgments
This webapp was inspired by a similar one that I saw in "The Simple Path to Wealth" by JL Collins. More versions are:
- [Shall We Play A (Market Timing) Game?](https://engaging-data.com/market-timing-game/)
- [Time The Market Game](https://www.personalfinanceclub.com/time-the-market-game/)
