// netlify/functions/getUserStats.js

const { MongoClient, ServerApiVersion } = require('mongodb');

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
});

let isConnected = false;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const usersCollection = database.collection('users');
    const visitorsCollection = database.collection('visitors');
    const globalStatsCollection = database.collection('globalStats');

    // Get username from query parameter
    const username = event.queryStringParameters?.username;

    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username parameter required' }),
      };
    }

    // Find user
    const user = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') }
    });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    // Get all games for this user (only fetch needed fields)
    const games = await visitorsCollection.find({ userId: user.userId })
      .project({
        hasStarted: 1,
        valid: 1,
        win: 1,
        durationOfGame: 1,
        portfolioCAGR: 1,
        buyHoldCAGR: 1,
        buys: 1,
        sells: 1,
        visitDate: 1,
        realMode: 1,
        winStreak: 1
      })
      .toArray();

    // Calculate stats
    const startedGames = games.filter(g => g.hasStarted === true);
    const validGames = games.filter(g => g.valid === true);
    const wins = validGames.filter(g => g.win === true);
    
    // Calculate time-based and cumulative stats
    const totalGameTimeSeconds = validGames.reduce((sum, g) => sum + (g.durationOfGame || 0), 0);
    const totalGameTimeMinutes = Math.floor(totalGameTimeSeconds / 60);
    const totalRealTimeMinutes = validGames.reduce((sum, g) => {
      // Each valid game represents 3 years of market time (approximation based on your settings)
      return sum + (3 * 365.25 * 24 * 60); // 3 years in minutes
    }, 0);
    const totalRealTimeYears = (totalRealTimeMinutes / (365.25 * 24 * 60)).toFixed(1);
    
    const totalBuys = validGames.reduce((sum, g) => sum + (g.buys || 0), 0);
    const totalSells = validGames.reduce((sum, g) => sum + (g.sells || 0), 0);
    const totalTrades = totalBuys + totalSells;

    // Get or update global stats cache
    let cachedGlobalStats = await globalStatsCollection.findOne({ _id: 'current' });
    
    // Check if cache is stale (older than 24 hours) or doesn't exist
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const isStale = !cachedGlobalStats || new Date(cachedGlobalStats.updatedAt) < oneDayAgo;
    
    if (isStale) {
      // Update the cache by calculating from all valid games
      const allValidGames = await visitorsCollection.find({ valid: true }).toArray();
      
      const globalAvgExcessCAGR = allValidGames.length > 0
        ? allValidGames.reduce((sum, g) => sum + (g.portfolioCAGR - g.buyHoldCAGR), 0) / allValidGames.length
        : 0;

      const allExcessReturns = allValidGames.map(g => g.portfolioCAGR - g.buyHoldCAGR).sort((a, b) => a - b);

      cachedGlobalStats = {
        _id: 'current',
        updatedAt: now,
        totalValidGames: allValidGames.length,
        globalAvgExcessCAGR,
        allExcessReturns
      };

      // Save to cache
      await globalStatsCollection.updateOne(
        { _id: 'current' },
        { $set: cachedGlobalStats },
        { upsert: true }
      );
    }
    
    // Calculate percentile ranking using cached data
    let percentileRank = 0;
    if (validGames.length > 0 && cachedGlobalStats.allExcessReturns && cachedGlobalStats.allExcessReturns.length > 0) {
      const userAvgExcess = validGames.reduce((sum, g) => sum + (g.portfolioCAGR - g.buyHoldCAGR), 0) / validGames.length;
      
      // Binary search to find position in sorted array
      let betterThanCount = 0;
      for (let excess of cachedGlobalStats.allExcessReturns) {
        if (excess < userAvgExcess) {
          betterThanCount++;
        } else {
          break;
        }
      }
      
      percentileRank = ((betterThanCount / cachedGlobalStats.allExcessReturns.length) * 100).toFixed(1);
    }
    
    const globalAvgExcessCAGR = cachedGlobalStats.globalAvgExcessCAGR || 0;
    
    // Calculate global win rate (percentage of all games that beat buy-and-hold)
    let globalWinRate = 0;
    let globalWinRateUncertainty = 0;
    if (cachedGlobalStats.allExcessReturns && cachedGlobalStats.allExcessReturns.length > 0) {
      const n = cachedGlobalStats.allExcessReturns.length;
      const wins = cachedGlobalStats.allExcessReturns.filter(excess => excess > 0).length;
      const p = wins / n;
      globalWinRate = (p * 100).toFixed(1);
      // Standard error for proportion: sqrt(p * (1-p) / n)
      const se = Math.sqrt(p * (1 - p) / n);
      globalWinRateUncertainty = (se * 100).toFixed(2);
    }
    
    const stats = {
      username: user.username,
      userId: user.userId,
      accountCreated: user.firstGameDate || user.createdAt,
      totalGames: startedGames.length,
      validGames: validGames.length,
      wins: wins.length,
      winRate: validGames.length > 0 ? (wins.length / validGames.length * 100).toFixed(2) : 0,
      avgExcessCAGR: validGames.length > 0 
        ? (validGames.reduce((sum, g) => sum + (g.portfolioCAGR - g.buyHoldCAGR), 0) / validGames.length).toFixed(2)
        : 0,
      avgExcessCAGRUncertainty: validGames.length > 0
        ? (() => {
            const excesses = validGames.map(g => g.portfolioCAGR - g.buyHoldCAGR);
            const mean = excesses.reduce((sum, val) => sum + val, 0) / excesses.length;
            const variance = excesses.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / excesses.length;
            const standardError = Math.sqrt(variance / excesses.length);
            return standardError.toFixed(2);
          })()
        : 0,
      bestExcessCAGR: validGames.length > 0
        ? Math.max(...validGames.map(g => g.portfolioCAGR - g.buyHoldCAGR)).toFixed(2)
        : 0,
      worstExcessCAGR: validGames.length > 0
        ? Math.min(...validGames.map(g => g.portfolioCAGR - g.buyHoldCAGR)).toFixed(2)
        : 0,
      avgTrades: validGames.length > 0
        ? (validGames.reduce((sum, g) => sum + (g.buys + g.sells), 0) / validGames.length).toFixed(2)
        : 0,
      totalGameTimeMinutes,
      totalRealTimeYears,
      totalTrades,
      totalBuys,
      totalSells,
      globalAvgExcessCAGR: globalAvgExcessCAGR.toFixed(2),
      globalWinRate,
      globalWinRateUncertainty,
      percentileRank,
      globalStatsCacheDate: cachedGlobalStats?.updatedAt,
      recentGames: games
        .filter(g => g.valid === true)
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
        .slice(0, 10)
    };

    return {
      statusCode: 200,
      body: JSON.stringify(stats),
    };
  } catch (error) {
    console.error('Error in getUserStats function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
