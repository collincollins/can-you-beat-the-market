// netlify/functions/updateGlobalStats.js
// Updates the cached global statistics once per day

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
});

let isConnected = false;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
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
    const visitorsCollection = database.collection('visitors');
    const globalStatsCollection = database.collection('globalStats');

    // Calculate global stats from all valid games
    const allValidGames = await visitorsCollection.find({ valid: true }).toArray();
    
    const globalAvgExcessCAGR = allValidGames.length > 0
      ? allValidGames.reduce((sum, g) => sum + (g.portfolioCAGR - g.buyHoldCAGR), 0) / allValidGames.length
      : 0;

    // Store all excess CAGR values for percentile calculations
    const allExcessReturns = allValidGames.map(g => g.portfolioCAGR - g.buyHoldCAGR).sort((a, b) => a - b);

    const globalStats = {
      _id: 'current',
      updatedAt: new Date(),
      totalValidGames: allValidGames.length,
      globalAvgExcessCAGR,
      allExcessReturns
    };

    // Upsert the global stats (replace or insert)
    await globalStatsCollection.updateOne(
      { _id: 'current' },
      { $set: globalStats },
      { upsert: true }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Global stats updated successfully',
        totalValidGames: allValidGames.length,
        globalAvgExcessCAGR: globalAvgExcessCAGR.toFixed(2)
      }),
    };
  } catch (error) {
    console.error('Error in updateGlobalStats function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
