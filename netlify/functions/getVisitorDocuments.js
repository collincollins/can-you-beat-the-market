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

    // base query criteria for both game modes.
    let query = {
      durationOfGame: { $gte: 10 },
      buys: { $exists: true },
      sells: { $exists: true },
      portfolioCAGR: { $exists: true },
      buyHoldCAGR: { $exists: true }
    };

    // read the realMode value from the query string (if provided).
    const { realMode } = event.queryStringParameters || {};

    if (realMode === "true") {
      // for real market mode, require that both startRealMarketDate and endRealMarketDate
      // exist and have non-null, non-zero values.
      query.startRealMarketDate = { $exists: true, $nin: [null, 0] };
      query.endRealMarketDate = { $exists: true, $nin: [null, 0] };
    } else {
      // for simulated mode, ensure that there are no meaningful real market dates.
      // we require that startRealMarketDate is either not present or is null/0,
      // and similarly for endRealMarketDate.
      query.$and = [
        {
          $or: [
            { startRealMarketDate: { $exists: false } },
            { startRealMarketDate: { $in: [null, 0] } }
          ]
        },
        {
          $or: [
            { endRealMarketDate: { $exists: false } },
            { endRealMarketDate: { $in: [null, 0] } }
          ]
        }
      ];
    }

    const visitorDocs = await visitorsCollection.find(query).toArray();

    return {
      statusCode: 200,
      body: JSON.stringify(visitorDocs),
    };
  } catch (error) {
    console.error('Error in getVisitorDocuments function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};