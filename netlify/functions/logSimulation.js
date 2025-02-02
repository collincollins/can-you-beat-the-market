// netlify/functions/logSimulation.js

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
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
    // Connect to MongoDB if not already connected.
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // Determine the database name based on deploy context.
    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);

    // Get the simulations collection.
    const simulationsCollection = database.collection('simulations');

    // Parse the incoming simulation data from the request body.
    const simulationData = JSON.parse(event.body);

    // Validate required fields (adjust the required fields as needed)
    const requiredFields = [
      'visitorId',
      'startTime',
      'endTime',
      'duration',
      'valid',
      'portfolioValue',
      'buyHoldFinalValue',
      'CAGR',
      'win',
      'winStreak',
      'buys',
      'sells',
      'simulationParameters'
    ];

    for (const field of requiredFields) {
      if (!(field in simulationData)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `Missing required field: ${field}` }),
        };
      }
    }

    // Insert the simulation document into the collection.
    const insertResult = await simulationsCollection.insertOne({
      visitorId: simulationData.visitorId,
      startTime: new Date(simulationData.startTime),
      endTime: new Date(simulationData.endTime),
      duration: simulationData.duration,
      valid: simulationData.valid,
      portfolioValue: simulationData.portfolioValue,
      buyHoldFinalValue: simulationData.buyHoldFinalValue,
      CAGR: simulationData.CAGR,
      win: simulationData.win,
      winStreak: simulationData.winStreak,
      buys: simulationData.buys,
      sells: simulationData.sells,
      simulationParameters: simulationData.simulationParameters,
      createdAt: new Date()
    });

    if (insertResult.acknowledged) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Simulation logged successfully.' }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to log simulation.' }),
      };
    }
  } catch (error) {
    console.error('Error in logSimulation function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};