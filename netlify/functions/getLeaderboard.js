// netlify/functions/getLeaderboard.js

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, deprecationErrors: true },
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
});

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    try {
      await cachedDb.admin().ping();
      return cachedDb;
    } catch (error) {
      console.log('Cached connection is stale, reconnecting...');
      cachedDb = null;
    }
  }

  try {
    await client.connect();
    cachedDb = client.db(
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket'
    );
    console.log('Successfully connected to MongoDB');
    return cachedDb;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const database = await connectToDatabase();
    const visitorsCollection = database.collection('visitors');
    const leaderboardCacheCollection = database.collection('leaderboardCache');

    const { realMode, force } = event.queryStringParameters || {};
    const cacheId = realMode === "true" ? 'realMode' : 'simulatedMode';
    
    // Check cache first (6 hour TTL) unless force refresh is requested
    const cachedData = await leaderboardCacheCollection.findOne({ _id: cacheId });
    const now = new Date();
    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
    const isCacheValid = cachedData && new Date(cachedData.updatedAt) > sixHoursAgo && force !== 'true';
    
    if (isCacheValid) {
      console.log(`Using cached leaderboard for ${cacheId}`);
      return {
        statusCode: 200,
        body: JSON.stringify(cachedData.data),
      };
    }
    
    if (force === 'true') {
      console.log(`Force refresh requested for ${cacheId}`);
    }

    console.log(`Regenerating leaderboard cache for ${cacheId}...`);

    // Base match criteria
    const baseMatch = {
      durationOfGame: { $gte: 10 },
      buys: { $exists: true },
      sells: { $exists: true },
      portfolioCAGR: { $exists: true },
      buyHoldCAGR: { $exists: true },
    };

    if (realMode === "true") {
      baseMatch.realMode = true;
      baseMatch.startRealMarketDate = { $exists: true, $nin: [null, 0] };
      baseMatch.endRealMarketDate = { $exists: true, $nin: [null, 0] };
    } else {
      baseMatch.$or = [
        { realMode: { $exists: false } },
        { realMode: false }
      ];
    }

    // Aggregate pipeline to add computed fields
    const pipeline = [
      { $match: baseMatch },
      {
        $addFields: {
          totalTrades: { $add: [{ $ifNull: ["$buys", 0] }, { $ifNull: ["$sells", 0] }] },
          excessReturn: { $subtract: ["$portfolioCAGR", "$buyHoldCAGR"] }
        }
      },
      {
        $match: {
          totalTrades: { $gte: 3, $lte: 25 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'userId',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          username: {
            $cond: {
              if: { $gt: [{ $size: "$userInfo" }, 0] },
              then: { $arrayElemAt: ["$userInfo.username", 0] },
              else: null
            }
          }
        }
      },
      {
        $project: {
          username: 1,
          totalTrades: 1,
          excessReturn: 1,
          portfolioCAGR: 1,
          buyHoldCAGR: 1,
          durationOfGame: 1
        }
      }
    ];

    const docs = await visitorsCollection.aggregate(pipeline).toArray();
    console.log(`Found ${docs.length} eligible games for leaderboard`);

    // Filter to only include games with usernames (registered users)
    const registeredDocs = docs.filter(d => d.username);
    console.log(`Found ${registeredDocs.length} games from registered users`);

    // Group by user and calculate cumulative statistics
    const userStats = {};
    registeredDocs.forEach(doc => {
      if (!userStats[doc.username]) {
        userStats[doc.username] = {
          username: doc.username,
          games: [],
          totalGames: 0,
          totalExcessReturn: 0,
          totalTrades: 0,
          totalDuration: 0
        };
      }
      const user = userStats[doc.username];
      user.games.push(doc);
      user.totalGames++;
      user.totalExcessReturn += doc.excessReturn;
      user.totalTrades += doc.totalTrades;
      user.totalDuration += doc.durationOfGame;
    });

    // Calculate average stats per user and filter to 5+ games
    const userArray = Object.values(userStats)
      .map(user => ({
        username: user.username,
        avgExcessReturn: user.totalExcessReturn / user.totalGames,
        totalGames: user.totalGames,
        avgTrades: user.totalTrades / user.totalGames,
        totalTrades: user.totalTrades
      }))
      .filter(user => user.totalGames >= 5);

    console.log(`Aggregated stats for ${userArray.length} unique users with 5+ games`);

    // Calculate mean excess return for "most average" calculation
    const meanExcessReturn = userArray.length > 0
      ? userArray.reduce((sum, user) => sum + user.avgExcessReturn, 0) / userArray.length
      : 0;
    
    // Calculate leaderboard stats (based on cumulative user performance)
    const leaderboard = {
      // Biggest Winner - highest average excess return across all games
      biggestWinner: userArray.length > 0 
        ? userArray.reduce((max, user) => user.avgExcessReturn > max.avgExcessReturn ? user : max)
        : null,
      
      // Biggest Loser - lowest average excess return across all games
      biggestLoser: userArray.length > 0
        ? userArray.reduce((min, user) => user.avgExcessReturn < min.avgExcessReturn ? user : min)
        : null,
      
      // Day Trader - highest average trades per game
      dayTrader: userArray.length > 0
        ? userArray.reduce((max, user) => user.avgTrades > max.avgTrades ? user : max)
        : null,
      
      // Diamond Hands - fewest average trades per game (most patient)
      diamondHands: userArray.length > 0
        ? userArray.reduce((min, user) => user.avgTrades < min.avgTrades ? user : min)
        : null,
      
      // Most Average - average excess return closest to the mean
      mostAverage: userArray.length > 0
        ? userArray
            .map(user => ({
              ...user,
              distanceFromMean: Math.abs(user.avgExcessReturn - meanExcessReturn)
            }))
            .reduce((closest, user) => 
              user.distanceFromMean < (closest.distanceFromMean || Infinity) ? user : closest
            )
        : null,
      
      // Coin Flipper - average excess return closest to 0
      coinFlipper: userArray.length > 0
        ? userArray
            .map(user => ({
              ...user,
              distanceFromZero: Math.abs(user.avgExcessReturn)
            }))
            .reduce((closest, user) => 
              user.distanceFromZero < (closest.distanceFromZero || Infinity) ? user : closest
            )
        : null
    };

    // Simplify objects to only include needed fields
    const simplifiedLeaderboard = {};
    for (const [key, value] of Object.entries(leaderboard)) {
      if (value) {
        simplifiedLeaderboard[key] = {
          username: value.username,
          excessReturn: value.avgExcessReturn, // Average across all their games
          avgTrades: value.avgTrades, // Average trades per game
          totalTrades: value.totalTrades, // Total trades across all games (for Day Trader)
          totalGames: value.totalGames // How many games they played
        };
      } else {
        simplifiedLeaderboard[key] = null;
      }
    }

    // Cache the result
    await leaderboardCacheCollection.updateOne(
      { _id: cacheId },
      { 
        $set: {
          _id: cacheId,
          updatedAt: now,
          data: simplifiedLeaderboard
        }
      },
      { upsert: true }
    );

    console.log(`Leaderboard cache updated for ${cacheId}`);

    return {
      statusCode: 200,
      body: JSON.stringify(simplifiedLeaderboard),
    };
  } catch (error) {
    console.error('Error in getLeaderboard function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};

