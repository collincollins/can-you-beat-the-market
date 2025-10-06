<script>
  import { onMount } from 'svelte';

  export let realMode;

  let leaderboard = null;
  let loading = true;

  async function fetchLeaderboard() {
    try {
      const url = realMode
        ? '/.netlify/functions/getLeaderboard?realMode=true'
        : '/.netlify/functions/getLeaderboard?realMode=false';
      
      const response = await fetch(url);
      if (response.ok) {
        leaderboard = await response.json();
      }
      loading = false;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      loading = false;
    }
  }

  onMount(() => {
    fetchLeaderboard();
  });

  $: if (realMode !== undefined) {
    loading = true;
    fetchLeaderboard();
  }
</script>

{#if !loading && leaderboard}
  <div class="leaderboard-grid">
    <!-- Biggest Winner -->
    <div class="stat-card positive">
      <div class="stat-emoji"></div>
      <div class="stat-title">Biggest Winner</div>
      <div class="stat-username">{leaderboard.biggestWinner?.username || 'Anonymous'}</div>
      <div class="stat-value">+{leaderboard.biggestWinner?.excessReturn.toFixed(1)}%</div>
    </div>

    <!-- Biggest Loser -->
    <div class="stat-card negative">
      <div class="stat-emoji"></div>
      <div class="stat-title">Biggest Loser</div>
      <div class="stat-username">{leaderboard.biggestLoser?.username || 'Anonymous'}</div>
      <div class="stat-value">{leaderboard.biggestLoser?.excessReturn.toFixed(1)}%</div>
    </div>

    <!-- Day Trader -->
    <div class="stat-card">
      <div class="stat-title">Day Trader</div>
      <div class="stat-username">{leaderboard.dayTrader?.username || 'Anonymous'}</div>
      <div class="stat-value">{leaderboard.dayTrader?.trades} trades</div>
    </div>

    <!-- Diamond Hands -->
    <div class="stat-card">
      <div class="stat-title">Diamond Hands</div>
      <div class="stat-username">{leaderboard.diamondHands?.username || 'Anonymous'}</div>
      <div class="stat-value">{leaderboard.diamondHands?.daysPerTrade} days/trade</div>
    </div>

    <!-- Most Average -->
    <div class="stat-card average">
      <div class="stat-title">Most Average</div>
      <div class="stat-username">{leaderboard.mostAverage?.username || 'Anonymous'}</div>
      <div class="stat-value">{leaderboard.mostAverage?.excessReturn > 0 ? '+' : ''}{leaderboard.mostAverage?.excessReturn.toFixed(1)}%</div>
    </div>

    <!-- Coin Flipper -->
    <div class="stat-card neutral">
      <div class="stat-title">Coin Flipper</div>
      <div class="stat-username">{leaderboard.coinFlipper?.username || 'Anonymous'}</div>
      <div class="stat-value">{leaderboard.coinFlipper?.excessReturn > 0 ? '+' : ''}{leaderboard.coinFlipper?.excessReturn.toFixed(1)}%</div>
    </div>
  </div>
{/if}

<style>
  .leaderboard-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 15px;
    max-width: 650px;
    margin-left: auto;
    margin-right: auto;
  }

  @media (max-width: 450px) {
    .leaderboard-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background-color: var(--color-background-card);
    border: 2px solid black;
    border-radius: 10px;
    padding: 12px;
    box-shadow: var(--shadow-default);
    text-align: center;
    font-size: 0.8em;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .stat-title {
    font-size: 0.75em;
    color: var(--color-neutral);
    font-weight: bold;
    text-transform: uppercase;
  }

  .stat-username {
    font-size: 0.9em;
    color: var(--color-primary);
    font-weight: bold;
    min-height: 1.2em;
    word-break: break-word;
  }

  .stat-value {
    font-size: 1.1em;
    font-weight: bold;
    color: var(--color-dark-text);
    margin-top: 2px;
  }

  .stat-card.positive {
    background-color: #e8f5e9;
    border-color: var(--color-success);
  }

  .stat-card.positive .stat-value {
    color: var(--color-success);
  }

  .stat-card.negative {
    background-color: #ffebee;
    border-color: var(--color-danger);
  }

  .stat-card.negative .stat-value {
    color: var(--color-danger);
  }

  .stat-card.average {
    background-color: #e3f2fd;
    border-color: #2196f3;
  }

  .stat-card.average .stat-value {
    color: #1565c0;
  }

  .stat-card.neutral {
    background-color: #f5f5f5;
    border-color: #9e9e9e;
  }

  .stat-card.neutral .stat-value {
    color: #616161;
  }
</style>

