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

{#if loading}
  <div class="leaderboard-grid">
    <!-- Skeleton loaders -->
    {#each Array(6) as _, i}
      <div class="stat-card skeleton">
        <div class="skeleton-username"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-value"></div>
        <div class="skeleton-games"></div>
      </div>
    {/each}
  </div>
{:else if leaderboard}
  <div class="leaderboard-grid">
    <!-- Biggest Winner -->
    <div class="stat-card">
      <div class="stat-username">{leaderboard.biggestWinner?.username || 'Anonymous'}</div>
      <div class="stat-title">Biggest winner</div>
      <div class="stat-value">+{leaderboard.biggestWinner?.excessReturn.toFixed(1)}%</div>
      <div class="stat-games">({leaderboard.biggestWinner?.totalGames} games)</div>
    </div>

    <!-- Biggest Loser -->
    <div class="stat-card">
      <div class="stat-username">{leaderboard.biggestLoser?.username || 'Anonymous'}</div>
      <div class="stat-title">Biggest loser</div>
      <div class="stat-value">{leaderboard.biggestLoser?.excessReturn.toFixed(1)}%</div>
      <div class="stat-games">({leaderboard.biggestLoser?.totalGames} games)</div>
    </div>

    <!-- Day Trader -->
    <div class="stat-card">
      <div class="stat-username">{leaderboard.dayTrader?.username || 'Anonymous'}</div>
      <div class="stat-title">Day trader</div>
      <div class="stat-value">{leaderboard.dayTrader?.avgTrades?.toFixed(1)} trades/game</div>
      <div class="stat-games">({leaderboard.dayTrader?.totalGames} games)</div>
    </div>

    <!-- Diamond Hands -->
    <div class="stat-card">
      <div class="stat-username">{leaderboard.diamondHands?.username || 'Anonymous'}</div>
      <div class="stat-title">Diamond hands</div>
      <div class="stat-value">{leaderboard.diamondHands?.avgTrades?.toFixed(1)} trades/game</div>
      <div class="stat-games">({leaderboard.diamondHands?.totalGames} games)</div>
    </div>

    <!-- Most Average -->
    <div class="stat-card">
      <div class="stat-username">{leaderboard.mostAverage?.username || 'Anonymous'}</div>
      <div class="stat-title">Most average</div>
      <div class="stat-value">{leaderboard.mostAverage?.excessReturn > 0 ? '+' : ''}{leaderboard.mostAverage?.excessReturn.toFixed(1)}%</div>
      <div class="stat-games">({leaderboard.mostAverage?.totalGames} games)</div>
    </div>

    <!-- Coin Flipper -->
    <div class="stat-card">
      <div class="stat-username">{leaderboard.coinFlipper?.username || 'Anonymous'}</div>
      <div class="stat-title">Coin flipper</div>
      <div class="stat-value">{leaderboard.coinFlipper?.excessReturn > 0 ? '+' : ''}{leaderboard.coinFlipper?.excessReturn.toFixed(1)}%</div>
      <div class="stat-games">({leaderboard.coinFlipper?.totalGames} games)</div>
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

  .stat-username {
    font-size: 1.3em;
    color: var(--color-primary);
    font-weight: bold;
    min-height: 1.2em;
    word-break: break-word;
  }

  .stat-title {
    font-size: 0.75em;
    color: var(--color-neutral);
    margin-top: 2px;
  }

  .stat-value {
    font-size: 0.95em;
    font-weight: bold;
    color: var(--color-dark-text);
    margin-top: 3px;
  }

  .stat-games {
    font-size: 0.6em;
    color: var(--color-neutral);
    margin-top: 2px;
  }

  /* Skeleton loader styles */
  .stat-card.skeleton {
    pointer-events: none;
  }

  .skeleton-username,
  .skeleton-title,
  .skeleton-value,
  .skeleton-games {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-username {
    height: 1.6em;
    width: 70%;
    margin: 0 auto;
  }

  .skeleton-title {
    height: 0.9em;
    width: 50%;
    margin: 5px auto 0;
  }

  .skeleton-value {
    height: 1em;
    width: 60%;
    margin: 8px auto 0;
  }

  .skeleton-games {
    height: 0.7em;
    width: 40%;
    margin: 5px auto 0;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>

