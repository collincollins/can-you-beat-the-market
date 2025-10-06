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

    const { realMode } = event.queryStringParameters || {};
    const cacheId = realMode === "true" ? 'realMode' : 'simulatedMode';
    
    // Check cache first (6 hour TTL)
    const cachedData = await leaderboardCacheCollection.findOne({ _id: cacheId });
    const now = new Date();
    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
    const isCacheValid = cachedData && new Date(cachedData.updatedAt) > sixHoursAgo;
    
    if (isCacheValid) {
      console.log(`Using cached leaderboard for ${cacheId}`);
      return {
        statusCode: 200,
        body: JSON.stringify(cachedData.data),
      };
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

    // Calculate mean excess return for "most average" calculation
    const meanExcessReturn = registeredDocs.length > 0
      ? registeredDocs.reduce((sum, doc) => sum + doc.excessReturn, 0) / registeredDocs.length
      : 0;
    
    // Calculate leaderboard stats
    const leaderboard = {
      // Biggest Winner - highest excess return
      biggestWinner: registeredDocs.length > 0 
        ? registeredDocs.reduce((max, doc) => doc.excessReturn > max.excessReturn ? doc : max)
        : null,
      
      // Biggest Loser - lowest excess return
      biggestLoser: registeredDocs.length > 0
        ? registeredDocs.reduce((min, doc) => doc.excessReturn < min.excessReturn ? doc : min)
        : null,
      
      // Day Trader - most trades
      dayTrader: registeredDocs.length > 0
        ? registeredDocs.reduce((max, doc) => doc.totalTrades > max.totalTrades ? doc : max)
        : null,
      
      // Diamond Hands - highest market days per trade ratio
      diamondHands: registeredDocs.length > 0
        ? registeredDocs
            .map(doc => ({ 
              ...doc, 
              daysPerTrade: doc.durationOfGame / doc.totalTrades 
            }))
            .reduce((max, doc) => doc.daysPerTrade > (max.daysPerTrade || 0) ? doc : max)
        : null,
      
      // Most Average - excess return closest to the mean
      mostAverage: registeredDocs.length > 0
        ? registeredDocs
            .map(doc => ({
              ...doc,
              distanceFromMean: Math.abs(doc.excessReturn - meanExcessReturn)
            }))
            .reduce((closest, doc) => 
              doc.distanceFromMean < (closest.distanceFromMean || Infinity) ? doc : closest
            )
        : null,
      
      // Coin Flipper - excess return closest to 0
      coinFlipper: registeredDocs.length > 0
        ? registeredDocs
            .map(doc => ({
              ...doc,
              distanceFromZero: Math.abs(doc.excessReturn)
            }))
            .reduce((closest, doc) => 
              doc.distanceFromZero < (closest.distanceFromZero || Infinity) ? doc : closest
            )
        : null
    };

    // Simplify objects to only include needed fields
    const simplifiedLeaderboard = {};
    for (const [key, value] of Object.entries(leaderboard)) {
      if (value) {
        simplifiedLeaderboard[key] = {
          username: value.username,
          excessReturn: value.excessReturn,
          trades: value.totalTrades,
          ...(value.daysPerTrade && { daysPerTrade: Math.round(value.daysPerTrade) })
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

