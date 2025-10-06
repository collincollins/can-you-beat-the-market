<script>
  import { onMount, onDestroy } from 'svelte';
  
  export let currentUser;
  export let onClose;
  
  let stats = null;
  let loading = true;
  let error = null;
  let linking = false;
  let refreshing = false;
  let isAdmin = false;
  let allUsers = [];
  let viewingUsername = null; // Username currently being viewed (for admin)

  async function fetchAllUsers() {
    if (currentUser?.username?.toLowerCase() === 'collin') {
      try {
        const response = await fetch(`/.netlify/functions/getAllUsers?username=${encodeURIComponent(currentUser.username)}`);
        if (response.ok) {
          allUsers = await response.json();
        }
      } catch (err) {
        console.error('Error fetching all users:', err);
      }
    }
  }

  async function fetchStats(usernameToFetch = null) {
    const targetUsername = usernameToFetch || currentUser?.username;
    
    if (!targetUsername) {
      error = 'No user logged in';
      loading = false;
      return;
    }

    viewingUsername = targetUsername;

    try {
      const response = await fetch(`/.netlify/functions/getUserStats?username=${encodeURIComponent(targetUsername)}&t=${Date.now()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch stats');
      }
      
      const data = await response.json();
      
      // Log global stats cache info if available
      if (data.globalStatsCacheDate) {
        const cacheAgeHours = Math.round((Date.now() - new Date(data.globalStatsCacheDate).getTime()) / (1000 * 60 * 60));
        const refreshAtHours = 24;
        const timeUntilRefresh = refreshAtHours - cacheAgeHours;
        const refreshMsg = timeUntilRefresh > 0 ? `Next refresh in ${timeUntilRefresh} hrs` : 'Refreshing now...';
        console.log(`Global Stats: ${cacheAgeHours}/${refreshAtHours} hrs (cached) - ${refreshMsg}`);
      }
      
      stats = data;
      loading = false;
      refreshing = false;
    } catch (err) {
      console.error('Error fetching stats:', err);
      error = `Failed to load stats: ${err.message}`;
      loading = false;
      refreshing = false;
    }
  }

  function setViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  onMount(async () => {
    // Set viewport height for iOS
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    
    // Prevent body scroll when stats page is open
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    // Check if user is admin (username is "collin") - do this after loading personal stats
    if (currentUser?.username?.toLowerCase() === 'collin') {
      isAdmin = true;
    }
    
    // Always load personal stats first
    fetchStats();
  });

  onDestroy(() => {
    // Restore body scroll when stats page closes
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    
    window.removeEventListener('resize', setViewportHeight);
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
      
      if (response.ok) {
        alert(`Successfully linked ${result.gamesLinked} games to your account!`);
        // Reload stats
        loading = true;
        await fetchStats();
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
      {#if isAdmin && !loading && stats}
        <button 
          class="refresh-button" 
          on:click={async () => { 
            viewingUsername = null; 
            stats = null;
            loading = true;
            await fetchAllUsers();
            loading = false;
          }}
          title="View all users"
        >
          All Users
        </button>
      {/if}
      <button 
        class="refresh-button" 
        on:click={() => { refreshing = true; loading = true; fetchStats(viewingUsername); }}
        disabled={refreshing || loading}
        title="Refresh stats"
      >
        <span class="refresh-icon">↻</span>
      </button>
      <button class="close-button" on:click={onClose}>✕</button>
    </div>

    {#if isAdmin && !viewingUsername}
      <!-- Admin User List -->
      <div class="admin-panel">
        <h2 style="font-size: 1em; margin-bottom: 15px;">All Users ({allUsers.length})</h2>
        <div class="user-list">
          {#each allUsers as user}
            <button class="user-list-item" on:click={() => { loading = true; fetchStats(user.username); }}>
              <span class="user-name">{user.username}</span>
              <span class="user-info">{user.validGames} games • {formatDate(user.createdAt)}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else if loading}
      <div class="stats-container">
        <!-- Skeleton loaders -->
        <div class="stat-card header-card skeleton">
          <div class="skeleton-title"></div>
          <div class="skeleton-subtitle"></div>
        </div>
        
        <!-- Overview skeleton -->
        <div class="stat-section">
          <h3 style="opacity: 0.5;">Overview</h3>
          <div class="stat-grid">
            {#each Array(4) as _}
              <div class="stat-card skeleton">
                <div class="skeleton-value"></div>
                <div class="skeleton-label"></div>
              </div>
            {/each}
          </div>
        </div>
        
        <!-- Performance skeleton -->
        <div class="stat-section">
          <h3 style="opacity: 0.5;">Performance</h3>
          <div class="stat-grid">
            {#each Array(4) as _}
              <div class="stat-card skeleton">
                <div class="skeleton-value"></div>
                <div class="skeleton-label"></div>
              </div>
            {/each}
          </div>
        </div>
        
        <!-- Cumulative stats skeleton -->
        <div class="stat-section">
          <h3 style="opacity: 0.5;">Cumulative Stats</h3>
          <div class="stat-grid">
            {#each Array(5) as _}
              <div class="stat-card skeleton">
                <div class="skeleton-value"></div>
                <div class="skeleton-label"></div>
              </div>
            {/each}
          </div>
        </div>
      </div>
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
              <div class="stat-value">{stats.wins}</div>
              <div class="stat-label">Wins</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.validGames}</div>
              <div class="stat-label">Valid Games</div>
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
            <div class="stat-card" class:negative={parseFloat(stats.worstExcessCAGR) < 0}>
              <div class="stat-value">{formatPercent(stats.worstExcessCAGR)}</div>
              <div class="stat-label">Worst Excess Return</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.avgTrades}</div>
              <div class="stat-label">Avg Trades/Game</div>
            </div>
            <div class="stat-card" class:positive={parseFloat(stats.bestExcessCAGR) > 0}>
              <div class="stat-value">{formatPercent(stats.bestExcessCAGR)}</div>
              <div class="stat-label">Best Excess Return</div>
            </div>
          </div>
        </div>

        <!-- Performance Insight -->
        {#if parseFloat(stats.avgExcessCAGR) !== 0}
          <div class="stat-section">
            <h3>Performance Insight</h3>
            <div class="stat-card insight-card">
              {#if parseFloat(stats.avgExcessCAGR) > 0}
                <p class="insight">On average, you beat buy-and-hold by <strong>{stats.avgExcessCAGR}%</strong> annually!</p>
              {:else}
                <p class="insight">On average, buy-and-hold outperforms your strategy by <strong>{Math.abs(stats.avgExcessCAGR)}%</strong> annually. Consider reducing trading frequency.</p>
              {/if}
            </div>
            
            <!-- Global Win Rate (Prominent) -->
            {#if stats.globalWinRate}
              <div class="stat-card" style="margin-top: 10px; background-color: #fff3cd; border-color: #ffc107; border-width: 3px;">
                <p class="insight" style="font-size: 0.85em; font-weight: bold; margin-bottom: 8px;">
                  The Reality of Market Timing:
                </p>
                <p class="insight" style="font-size: 0.95em; font-weight: bold; margin-bottom: 12px;">
                  Only <strong style="font-size: 1.3em; color: var(--color-danger);">{stats.globalWinRate}%</strong> of all games beat buy-and-hold
                </p>
                
                <p class="insight" style="font-size: 0.7em; margin-bottom: 8px; font-weight: bold;">
                  Odds of beating buy-and-hold consecutively:
                </p>
                
                <table class="probability-table">
                  <thead>
                    <tr>
                      <th>Times</th>
                      <th>Probability</th>
                      <th>1 in</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2×</td>
                      <td>{(Math.pow(stats.globalWinRate / 100, 2) * 100).toFixed(2)}%</td>
                      <td>{Math.round(1 / Math.pow(stats.globalWinRate / 100, 2)).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>5×</td>
                      <td>{(Math.pow(stats.globalWinRate / 100, 5) * 100).toFixed(3)}%</td>
                      <td>{Math.round(1 / Math.pow(stats.globalWinRate / 100, 5)).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>10×</td>
                      <td>{(Math.pow(stats.globalWinRate / 100, 10) * 100).toFixed(5)}%</td>
                      <td>{Math.round(1 / Math.pow(stats.globalWinRate / 100, 10)).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>15×</td>
                      <td>{(Math.pow(stats.globalWinRate / 100, 15) * 100).toFixed(7)}%</td>
                      <td>{Math.round(1 / Math.pow(stats.globalWinRate / 100, 15)).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            {/if}

          </div>
        {/if}

        <!-- Cumulative Stats -->
        {#if stats.validGames > 0}
          <div class="stat-section">
            <h3>Cumulative Stats</h3>
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-value">{stats.totalGameTimeMinutes}</div>
                <div class="stat-label">Minutes<br>(Real Time)</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{stats.totalRealTimeYears}</div>
                <div class="stat-label">Years<br>(Market Time)</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{stats.totalTrades}</div>
                <div class="stat-label">Total<br>Trades</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{stats.totalBuys}</div>
                <div class="stat-label">Total<br>Buys</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{stats.totalSells}</div>
                <div class="stat-label">Total<br>Sells</div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Recent Games -->
        {#if stats.recentGames && stats.recentGames.length > 0}
          <div class="stat-section">
            <h3>Recent Games</h3>
            <div class="recent-games">
              {#each stats.recentGames.slice(0, 20) as game}
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
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: var(--color-background-dark);
    z-index: 1000;
    overflow-y: scroll;
    padding: 10px;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .stats-page {
    max-width: 700px;
    width: 93%;
    margin: 0 auto;
    transform: translateX(-10px);
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

  .refresh-button {
    font-family: 'Press Start 2P', cursive;
    background-color: var(--color-button-default);
    border: 2px solid black;
    color: white;
    padding: 8px 12px;
    font-size: 0.7em;
    cursor: pointer;
    border-radius: 10px;
    box-shadow: var(--shadow-default);
    touch-action: manipulation;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-button:hover:not(:disabled) {
    background-color: var(--color-button-hover);
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-icon {
    font-size: 1.3em;
    line-height: 1;
    position: relative;
    top: -3px;
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
    background-color: var(--color-background-card);
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

  .stat-section:has(.stat-grid > :nth-child(5)) .stat-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 500px) {
    .stat-section:has(.stat-grid > :nth-child(5)) .stat-grid {
      grid-template-columns: repeat(2, 1fr);
    }
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

  .game-card:not(.win) {
    background-color: #ffebee;
    border-color: var(--color-danger);
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

  .probability-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 5px;
    font-size: 0.75em;
  }

  .probability-table th,
  .probability-table td {
    padding: 6px 8px;
    text-align: center;
    border: 1px solid #000;
  }

  .probability-table th {
    background-color: #f0f0f0;
    font-weight: bold;
  }

  .probability-table tbody tr:nth-child(even) {
    background-color: #fafafa;
  }

  .probability-table tbody tr:hover {
    background-color: #f5f5f5;
  }

  .admin-panel {
    padding: 10px;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 70vh;
    overflow-y: auto;
  }

  .user-list-item {
    font-family: 'Press Start 2P', cursive;
    background-color: var(--color-background-card);
    border: 2px solid black;
    border-radius: 10px;
    padding: 12px 15px;
    box-shadow: var(--shadow-light);
    cursor: pointer;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;
  }

  .user-list-item:hover {
    background-color: #e0e4ed;
    transform: translateY(-1px);
    box-shadow: 3px 3px 0px black;
  }

  .user-name {
    font-size: 0.8em;
    font-weight: bold;
    color: var(--color-primary);
  }

  .user-info {
    font-size: 0.6em;
    color: var(--color-neutral);
  }

  /* Skeleton loader styles */
  .stat-card.skeleton {
    pointer-events: none;
  }

  .skeleton-title,
  .skeleton-subtitle,
  .skeleton-value,
  .skeleton-label {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-title {
    height: 2em;
    width: 60%;
    margin: 0 auto 10px;
  }

  .skeleton-subtitle {
    height: 1em;
    width: 40%;
    margin: 0 auto;
  }

  .skeleton-value {
    height: 2.2em;
    width: 70%;
    margin: 0 auto 8px;
  }

  .skeleton-label {
    height: 1em;
    width: 80%;
    margin: 0 auto;
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
