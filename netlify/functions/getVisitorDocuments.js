// netlify/functions/getVisitorDocuments.js

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, deprecationErrors: true },
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

    // determine the appropriate database name.
    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');
    const chartDataCacheCollection = database.collection('chartDataCache');

    // read the realMode parameter from the query string.
    // (if realMode is "true", use the real mode pipeline; otherwise, use simulation mode.)
    const { realMode } = event.queryStringParameters || {};
    
    const cacheId = realMode === "true" ? 'realMode' : 'simulatedMode';
    
    // Check cache first
    const cachedData = await chartDataCacheCollection.findOne({ _id: cacheId });
    const now = new Date();
    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
    const isCacheValid = cachedData && new Date(cachedData.updatedAt) > sixHoursAgo;
    
    if (isCacheValid) {
      console.log(`Using cached chart data for ${cacheId}, updated at:`, cachedData.updatedAt);
      return {
        statusCode: 200,
        body: JSON.stringify(cachedData.data),
        headers: {
          'X-Cache-Date': cachedData.updatedAt.toISOString()
        }
      };
    }
    
    // Cache miss or stale - recalculate
    console.log(`Cache stale or missing for ${cacheId}, recalculating...`);

    let pipeline = [];

    if (realMode === "true") {
      // real mode: require that the document explicitly indicates real mode and has valid market dates.
      pipeline = [
        {
          $match: {
            durationOfGame: { $gte: 10 },
            buys: { $exists: true },
            sells: { $exists: true },
            portfolioCAGR: { $exists: true },
            buyHoldCAGR: { $exists: true },
            realMode: true,
            startRealMarketDate: { $exists: true, $nin: [null, 0] },
            endRealMarketDate: { $exists: true, $nin: [null, 0] }
          }
        },
        {
          $addFields: {
            totalTrades: {
              $add: [
                { $ifNull: ["$buys", 0] },
                { $ifNull: ["$sells", 0] }
              ]
            }
          }
        },
        {
          $match: {
            totalTrades: { $gt: 2, $lte: 25 }
          }
        },
        {
          $project: {
            _id: 1,
            portfolioCAGR: 1,
            buyHoldCAGR: 1,
            totalTrades: 1
          }
        }
      ];
    } else {
      // simulation mode: include documents that either lack the realMode field or have it set to false.
      pipeline = [
        {
          $match: {
            durationOfGame: { $gte: 10 },
            buys: { $exists: true },
            sells: { $exists: true },
            portfolioCAGR: { $exists: true },
            buyHoldCAGR: { $exists: true },
            $or: [
              { realMode: { $exists: false } },
              { realMode: false }
            ]
          }
        },
        {
          $addFields: {
            totalTrades: {
              $add: [
                { $ifNull: ["$buys", 0] },
                { $ifNull: ["$sells", 0] }
              ]
            }
          }
        },
        {
          $match: {
            totalTrades: { $gt: 2, $lte: 25 },
          }
        },
        {
          $project: {
            _id: 1,
            portfolioCAGR: 1,
            buyHoldCAGR: 1,
            totalTrades: 1
          }
        }
      ];
    }
    const visitorDocs = await visitorsCollection.aggregate(pipeline).toArray();

    // Update cache
    const cacheDoc = {
      _id: cacheId,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      totalGames: visitorDocs.length,
      data: visitorDocs
    };

    await chartDataCacheCollection.updateOne(
      { _id: cacheId },
      { $set: cacheDoc },
      { upsert: true }
    );

    console.log(`Chart data cache updated for ${cacheId} with ${visitorDocs.length} games`);

    return {
      statusCode: 200,
      body: JSON.stringify(visitorDocs),
      headers: {
        'X-Cache-Date': now.toISOString(),
        'X-Cache-Status': 'MISS'
      }
    };
  } catch (error) {
    console.error('Error in getVisitorDocuments function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};