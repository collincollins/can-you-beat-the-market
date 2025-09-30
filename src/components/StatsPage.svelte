<script>
  import { onMount } from 'svelte';
  
  export let currentUser;
  export let onClose;
  
  let stats = null;
  let loading = true;
  let error = null;
  let linking = false;

  onMount(async () => {
    if (!currentUser?.username) {
      error = 'No user logged in';
      loading = false;
      return;
    }

    console.log('Fetching stats for:', currentUser.username);

    try {
      const response = await fetch(`/.netlify/functions/getUserStats?username=${encodeURIComponent(currentUser.username)}`);
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to fetch stats');
      }
      
      const data = await response.json();
      console.log('Stats data received:', data);
      stats = data;
      loading = false;
    } catch (err) {
      console.error('Error fetching stats:', err);
      error = `Failed to load stats: ${err.message}`;
      loading = false;
    }
  });

  function formatPercent(num) {
    return num >= 0 ? `+${num}%` : `${num}%`;
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  async function linkGamesManually() {
    if (!currentUser?.username) return;
    
    linking = true;
    try {
      const response = await fetch('/.netlify/functions/manualLinkGames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });

      const result = await response.json();
      console.log('Link result:', result);
      
      if (response.ok) {
        alert(`Successfully linked ${result.gamesLinked} games to your account!`);
        // Reload stats
        location.reload();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (err) {
      console.error('Error linking games:', err);
      alert('Failed to link games. Check console for details.');
    } finally {
      linking = false;
    }
  }
</script>

<div class="stats-overlay">
  <div class="stats-page">
    <div class="header">
      <h1>Your Stats</h1>
      <button class="close-button" on:click={onClose}>✕</button>
    </div>

    {#if loading}
      <div class="loading">Loading your stats...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if stats}
      <!-- Show link button if no games found -->
      {#if stats.totalGames === 0}
        <div class="stat-card" style="background-color: #fff3cd; border-color: #ffc107;">
          <h3 style="font-size: 0.8em; margin-bottom: 10px;">No Games Found</h3>
          <p style="font-size: 0.7em; margin-bottom: 15px;">
            If you played games before logging in, click below to link them to your account.
          </p>
          <button 
            class="link-button" 
            on:click={linkGamesManually}
            disabled={linking}
          >
            {linking ? 'Linking...' : 'Link My Games'}
          </button>
        </div>
      {/if}
      <div class="stats-container">
        <!-- Debug Info -->
        <div class="stat-card" style="font-size: 0.6em; text-align: left;">
          <strong>Debug:</strong> userId: {stats.userId}<br>
          Raw stats: {JSON.stringify(stats, null, 2).substring(0, 200)}...
        </div>

        <!-- User Info -->
        <div class="stat-card header-card">
          <h2>{stats.username}</h2>
          <p class="joined-date">Member since {formatDate(stats.accountCreated)}</p>
        </div>

        <!-- Overview Stats -->
        <div class="stat-section">
          <h3>Overview</h3>
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-value">{stats.totalGames}</div>
              <div class="stat-label">Total Games</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.validGames}</div>
              <div class="stat-label">Valid Games</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.wins}</div>
              <div class="stat-label">Wins</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.winRate}%</div>
              <div class="stat-label">Win Rate</div>
            </div>
          </div>
        </div>

        <!-- Performance Stats -->
        <div class="stat-section">
          <h3>Performance</h3>
          <div class="stat-grid">
            <div class="stat-card" class:positive={parseFloat(stats.avgExcessCAGR) > 0} class:negative={parseFloat(stats.avgExcessCAGR) < 0}>
              <div class="stat-value">{formatPercent(stats.avgExcessCAGR)}</div>
              <div class="stat-label">Avg Excess Return</div>
            </div>
            <div class="stat-card" class:positive={parseFloat(stats.bestExcessCAGR) > 0}>
              <div class="stat-value">{formatPercent(stats.bestExcessCAGR)}</div>
              <div class="stat-label">Best Excess Return</div>
            </div>
            <div class="stat-card" class:negative={parseFloat(stats.worstExcessCAGR) < 0}>
              <div class="stat-value">{formatPercent(stats.worstExcessCAGR)}</div>
              <div class="stat-label">Worst Excess Return</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.avgTrades}</div>
              <div class="stat-label">Avg Trades/Game</div>
            </div>
          </div>
        </div>

        <!-- Trading Style Insight -->
        {#if stats.avgTrades}
          <div class="stat-section">
            <h3>Trading Style</h3>
            <div class="stat-card insight-card">
              {#if parseFloat(stats.avgTrades) < 2}
                <p class="insight">🛡️ <strong>Conservative Trader</strong> - You make few trades and tend to hold positions.</p>
              {:else if parseFloat(stats.avgTrades) < 5}
                <p class="insight">⚖️ <strong>Balanced Trader</strong> - You make a moderate number of trades.</p>
              {:else}
                <p class="insight">⚡ <strong>Active Trader</strong> - You make frequent trades and actively manage positions.</p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Performance Insight -->
        {#if parseFloat(stats.avgExcessCAGR) !== 0}
          <div class="stat-section">
            <h3>Performance Insight</h3>
            <div class="stat-card insight-card">
              {#if parseFloat(stats.avgExcessCAGR) > 0}
                <p class="insight">📈 On average, you beat buy-and-hold by <strong>{stats.avgExcessCAGR}%</strong> annually!</p>
              {:else}
                <p class="insight">📊 On average, buy-and-hold outperforms your strategy by <strong>{Math.abs(stats.avgExcessCAGR)}%</strong> annually. Consider reducing trading frequency.</p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Recent Games -->
        {#if stats.recentGames && stats.recentGames.length > 0}
          <div class="stat-section">
            <h3>Recent Games</h3>
            <div class="recent-games">
              {#each stats.recentGames.slice(0, 5) as game}
                {#if game.valid}
                  <div class="game-card" class:win={game.win}>
                    <div class="game-date">{formatDate(game.visitDate)}</div>
                    <div class="game-result">
                      {game.win ? '✓ Win' : '✗ Loss'}
                    </div>
                    <div class="game-stats">
                      <span>{game.buys + game.sells} trades</span>
                      <span class:positive={game.portfolioCAGR > game.buyHoldCAGR} class:negative={game.portfolioCAGR < game.buyHoldCAGR}>
                        {formatPercent((game.portfolioCAGR - game.buyHoldCAGR).toFixed(2))}
                      </span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .stats-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--color-background-dark);
    z-index: 1000;
    overflow-y: auto;
    padding: 10px;
  }

  .stats-page {
    max-width: 700px;
    width: 93%;
    margin: 0 auto;
    padding-bottom: 40px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .header h1 {
    font-size: 1.2em;
    color: var(--color-primary);
    margin: 0;
    flex: 1;
  }

  .close-button {
    font-family: 'Press Start 2P', cursive;
    background-color: var(--color-danger);
    border: 2px solid black;
    color: white;
    padding: 8px 12px;
    font-size: 0.7em;
    cursor: pointer;
    border-radius: 10px;
    box-shadow: var(--shadow-default);
    touch-action: manipulation;
  }

  .close-button:hover {
    background-color: #a62525;
  }

  .loading, .error {
    text-align: center;
    padding: 20px;
    font-size: 0.7em;
    color: var(--color-dark-text);
  }

  .error {
    color: var(--color-danger);
  }

  .stats-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .stat-section {
    margin-bottom: 5px;
  }

  .stat-section h3 {
    color: var(--color-dark-text);
    font-size: 0.9em;
    margin-bottom: 10px;
    text-align: center;
  }

  .stat-card {
    background-color: var(--color-background-card);
    border: 2px solid black;
    border-radius: 10px;
    padding: 15px;
    box-shadow: var(--shadow-default);
    text-align: center;
    font-size: 0.8em;
  }

  .stat-card.header-card {
    background-color: #ccd0dcd9;
  }

  .stat-card h2 {
    margin: 0 0 5px 0;
    color: var(--color-primary);
    font-size: 1.3em;
  }

  .joined-date {
    margin: 0;
    font-size: 0.6em;
    color: var(--color-neutral);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stat-value {
    font-size: 1.5em;
    font-weight: bold;
    color: var(--color-dark-text);
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 0.6em;
    color: var(--color-neutral);
    line-height: 1.3;
  }

  .stat-card.positive .stat-value {
    color: var(--color-success);
  }

  .stat-card.negative .stat-value {
    color: var(--color-danger);
  }

  .positive {
    color: var(--color-success);
  }

  .negative {
    color: var(--color-danger);
  }

  .insight-card {
    background-color: var(--color-pure-white);
  }

  .insight {
    margin: 0;
    font-size: 0.7em;
    color: var(--color-dark-text);
    line-height: 1.5;
  }

  .recent-games {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .game-card {
    background-color: var(--color-background-card);
    border: 2px solid black;
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: var(--shadow-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.7em;
  }

  .game-card.win {
    border-color: var(--color-success);
    background-color: #e8f5e9;
  }

  .game-date {
    font-size: 0.85em;
    color: var(--color-neutral);
    flex: 1;
    min-width: 80px;
  }

  .game-result {
    font-size: 0.9em;
    font-weight: bold;
    flex: 0 0 auto;
  }

  .game-card.win .game-result {
    color: var(--color-success);
  }

  .game-card:not(.win) .game-result {
    color: var(--color-danger);
  }

  .game-stats {
    display: flex;
    gap: 10px;
    font-size: 0.85em;
    flex: 0 0 auto;
  }

  .link-button {
    font-family: 'Press Start 2P', cursive;
    background-color: var(--color-button-default);
    border: 2px solid black;
    color: white;
    padding: 10px 20px;
    font-size: 0.8em;
    cursor: pointer;
    border-radius: 10px;
    box-shadow: var(--shadow-default);
    touch-action: manipulation;
  }

  .link-button:hover:not(:disabled) {
    background-color: var(--color-button-hover);
  }

  .link-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
