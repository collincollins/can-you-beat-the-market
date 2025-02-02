// netlify/functions/updateVisitorStats.js

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

    // Expecting the payload to include visitorId and simulation results
    const {
      visitorId,
      simulationStartTime,
      simulationValid,
      portfolioValue,
      currentDay,
      win, // boolean indicating if the simulation was a win
      simulationDuration,
      buys,
      sells
      // ... additional fields can be added as needed
    } = JSON.parse(event.body);

    if (!visitorId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing visitorId' }),
      };
    }

    // Build update operations:
    // - Set hasPlayed to true and update mostRecentGame to simulationStartTime.
    // - Increment totalGames, and if simulationValid is true, increment validGames.
    // - Increment wins if win is true; otherwise increment losses.
    // - Increment totalTimePlaying, and increment trade counts (these could later be used to compute averages).
    const updateOps = {
      $set: {
        hasPlayed: true,
        mostRecentGame: new Date(simulationStartTime)
      },
      $inc: {
        totalGames: 1,
        validGames: simulationValid ? 1 : 0,
        wins: simulationValid && win ? 1 : 0,
        losses: simulationValid && !win ? 1 : 0,
        totalTimePlaying: simulationDuration,
        avgBuysPerGame: buys,
        avgSellsPerGame: sells
      }
    };

    // If this is the visitor's first game, set firstGame.
    updateOps.$setOnInsert = { firstGame: new Date(simulationStartTime) };

    const result = await visitorsCollection.updateOne(
      { _id: visitorId },
      updateOps,
      { upsert: true }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Visitor stats updated successfully.' }),
    };
  } catch (error) {
    console.error('Error in updateVisitorStats function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};