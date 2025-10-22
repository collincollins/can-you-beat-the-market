// netlify/functions/getVisitorDocuments.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

/**
 * Calculate linear regression from data points
 * Returns slope, intercept, and slope uncertainty
 */
function calculateRegression(data) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, slopeUncertainty: 0 };
  
  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const sumXY = data.reduce((sum, p) => sum + (p.x * p.y), 0);
  const sumX2 = data.reduce((sum, p) => sum + (p.x * p.x), 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate uncertainty
  const predictions = data.map(p => slope * p.x + intercept);
  const residuals = data.map((p, i) => p.y - predictions[i]);
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const variance = rss / (n - 2);
  const xMean = sumX / n;
  const sxx = sumX2 - (sumX * sumX) / n;
  const slopeUncertainty = Math.sqrt(variance / sxx);
  
  return { slope, intercept, slopeUncertainty };
}

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
    // Verify the connection is still alive
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
  // Don't wait for empty event loop (allows connection reuse)
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
    const chartDataCacheCollection = database.collection('chartDataCache');

    // read the realMode parameter from the query string.
    // (if realMode is "true", use the real mode pipeline; otherwise, use simulation mode.)
    const { realMode, force } = event.queryStringParameters || {};
    
    const cacheId = realMode === "true" ? 'realMode' : 'simulatedMode';
    
    // Check cache first (unless force refresh requested)
    const cachedData = await chartDataCacheCollection.findOne({ _id: cacheId });
    const now = new Date();
    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
    const isCacheValid = cachedData && new Date(cachedData.updatedAt) > sixHoursAgo && force !== 'true';
    
    if (force === 'true') {
      console.log(`Force refresh requested for ${cacheId}`);
    }
    
    if (isCacheValid) {
      console.log(`Using cached chart data for ${cacheId}, updated at:`, cachedData.updatedAt);
      
      // Compress the response to stay under Lambda's 6MB limit
      const jsonString = JSON.stringify(cachedData.data);
      const compressed = await gzip(jsonString);
      
      console.log(`Response size: ${jsonString.length} bytes uncompressed, ${compressed.length} bytes compressed`);
      
      return {
        statusCode: 200,
        body: compressed.toString('base64'),
        headers: {
          'X-Cache-Date': cachedData.updatedAt.toISOString(),
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/json'
        },
        isBase64Encoded: true
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
            _id: 0,
            portfolioCAGR: { $round: ["$portfolioCAGR", 3] },
            buyHoldCAGR: { $round: ["$buyHoldCAGR", 3] },
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
            _id: 0,
            portfolioCAGR: { $round: ["$portfolioCAGR", 3] },
            buyHoldCAGR: { $round: ["$buyHoldCAGR", 3] },
            totalTrades: 1
          }
        }
      ];
    }
    
    // DEPRECATED APPROACH - kept for reference
    // Old approach: Return all individual games (433 KB per response)
    // This was causing $28/month in bandwidth costs
    // const visitorDocs = await visitorsCollection
    //   .aggregate(pipeline, { maxTimeMS: 25000 })
    //   .toArray();
    
    // NEW APPROACH: Return only aggregated means (reduces payload by 99.9%)
    // Add timeout to prevent long-running queries
    const visitorDocs = await visitorsCollection
      .aggregate(pipeline, { maxTimeMS: 25000 })
      .toArray();

    // Group by trade count and calculate means
    const tradeGroups = {};
    visitorDocs.forEach(doc => {
      const trades = doc.totalTrades;
      if (!tradeGroups[trades]) {
        tradeGroups[trades] = {
          x: trades,
          excessReturns: [],
          count: 0
        };
      }
      const excessReturn = doc.portfolioCAGR - doc.buyHoldCAGR;
      tradeGroups[trades].excessReturns.push(excessReturn);
      tradeGroups[trades].count++;
    });

    // Calculate means for each trade count
    const meanData = Object.values(tradeGroups).map(group => ({
      x: group.x,
      y: group.excessReturns.reduce((sum, val) => sum + val, 0) / group.count,
      count: group.count
    })).sort((a, b) => a.x - b.x);

    // Calculate regression from means
    const { slope, intercept, slopeUncertainty } = calculateRegression(meanData);

    // Create aggregated response
    const aggregatedData = {
      meanData,
      regression: {
        slope,
        intercept,
        slopeUncertainty,
        points: [
          { x: meanData[0].x, y: slope * meanData[0].x + intercept },
          { x: meanData[meanData.length - 1].x, y: slope * meanData[meanData.length - 1].x + intercept }
        ]
      },
      totalGames: visitorDocs.length,
      isAggregated: true // flag to indicate new format
    };

    // Update cache
    const cacheDoc = {
      _id: cacheId,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      totalGames: visitorDocs.length,
      data: aggregatedData
    };

    await chartDataCacheCollection.updateOne(
      { _id: cacheId },
      { $set: cacheDoc },
      { upsert: true }
    );

    console.log(`Chart data cache updated for ${cacheId} with ${visitorDocs.length} games (aggregated to ${meanData.length} points)`);

    // Compress the response
    const jsonString = JSON.stringify(aggregatedData);
    const compressed = await gzip(jsonString);
    
    console.log(`Response size: ${jsonString.length} bytes uncompressed, ${compressed.length} bytes compressed (was ~433KB before optimization)`);

    return {
      statusCode: 200,
      body: compressed.toString('base64'),
      headers: {
        'X-Cache-Date': now.toISOString(),
        'X-Cache-Status': 'MISS',
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json'
      },
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Error in getVisitorDocuments function:', error);
    
    // Provide more specific error messages
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';
    
    if (error.name === 'MongoServerError' && error.code === 50) {
      statusCode = 504;
      errorMessage = 'Database query timeout - the query took too long to execute';
    } else if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      statusCode = 503;
      errorMessage = 'Database connection error - please try again';
    }
    
    return {
      statusCode,
      body: JSON.stringify({ 
        message: errorMessage,
        error: process.env.CONTEXT === 'deploy-preview' ? error.message : undefined
      }),
    };
  }
};