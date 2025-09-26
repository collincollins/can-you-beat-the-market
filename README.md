[![Netlify Status](https://api.netlify.com/api/v1/badges/fb0513ca-dddd-4891-a9a2-934b0ce4f56b/deploy-status)](https://app.netlify.com/sites/canyoubeatthemarket/deploys)

# Can You Beat The Market?
A neo-brutalist simulation game that challenges you to time your trades and outperform a simple buy‐and‐hold strategy using a positively biased geometric Brownian motion model.

## Overview
This project is built with Svelte and bundled with Vite. It leverages Chart.js for real-time charting and Netlify serverless functions to handle backend operations such as high score management and visitor counting.

## Key Features
- Market Simulation: Implements a market model via geometric Brownian motion (see ```src/logic/simulation.js``` and ```src/logic/simulationConfig.js```) to simulate daily price movements over several simulated years.
- Trading Mechanics: Users interact with the simulation by executing buy and sell actions using on-screen controls (see ```src/components/Controls```svelte). These actions update the user’s portfolio based on current market prices and rolling averages.
- Rolling Averages: The simulation calculates rolling averages (with a default window size of 2) to determine trade execution prices.
- Performance Comparison: At the end of a simulation run, the app compares your trading performance (annualized returns calculated as CAGR) with a buy‐and‐hold strategy.
- High Score & Win Streaks: Tracks consecutive wins and high scores. When you set a new record, you are prompted via a username modal (see ```src/components/UsernameModal.svelte```) to submit your name. Data is stored using Netlify functions that connect to a MongoDB cluster.
- Visitor Counting & Hit Tracking: Netlify functions handle backend tasks such as counting unique visitors and page hits.

## Code Structure
- ```src/App.svelte```: The main application component that orchestrates the simulation flow, user interactions, timer controls, and result calculations. It integrates various components and Svelte stores for state management.
- ```src/logic/simulation.js```: Contains the MarketSimulation class that simulates market price movements, updates portfolio values, and records every price change.
- ```src/logic/simulationConfig.js```: Centralizes simulation parameters (e.g., duration, annual drift, and volatility) for the market simulation.
- ```src/logic/store.js```: Implements Svelte writable stores to hold reactive state data for market prices, user portfolio, high scores, and consecutive wins.
- ```src/components/MarketChart.svelte```: Uses Chart.js to render a live chart that displays the market price trajectory, along with markers for buy and sell events.
- ```src/components/Controls.svelte``` & ```src/components/UsernameModal.svelte```: Offer user interface elements for executing trades and submitting high score data respectively.
- Netlify Functions (in ```netlify/functions```): Serverless functions for visitor tracking (```createVisitorDocument.js```, ```updateVisitorDocument.js```, ```getVisitorDocuments.js```), high score management (```setHighScore.js```, ```getHighScore.js```), visitor counting (```getVisitorCount.js```), and analytics (```logCoffeeClick.js```). These functions connect to a MongoDB cluster.

## How It Works
- Simulation Flow:
  - When you start the simulation (via the start button in ```App.svelte```), the app sets up a timer and configures the simulation parameters based on your input (including an optional “Slowmo” mode).
  - The market simulation runs by playing back pre-generated market data, updating prices in real-time and adjusting the user's portfolio accordingly.
  - Trading actions (buy/sell) update the portfolio using the current market data.
- Ending a Simulation:
  - When the timer expires, the simulation stops. The app then calculates and compares the annualized return (CAGR) of your portfolio against a buy‐and‐hold strategy.
  - If your performance exceeds that of buy-and-hold, your win streak is incremented and a new high score may be recorded through a Netlify function call.

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
