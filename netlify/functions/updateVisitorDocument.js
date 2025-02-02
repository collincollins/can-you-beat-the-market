// netlify/functions/updateVisitorDocument.js

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
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // Ensure we are connected
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // Determine the database name based on deploy context
    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');

    // Parse the incoming POST payload
    const {
      documentId,          // The _id of the visitor document (string)
      hasStarted,          // Boolean: whether the user started a simulation
      naturalEnd,          // Boolean: true if the simulation ended naturally
      valid,               // Boolean: true if the simulation is valid (met required duration)
      endGameDate,         // Date/time when the simulation ended
      durationOfGame,      // Duration of the game (in seconds)
      portfolioValue,      // Ending portfolio value
      buyHoldFinalValue,   // Ending buy-and-hold value
      portfolioCAGR,       // Portfolio's CAGR computed from simulation
      buyHoldCAGR,         // Buy-and-hold CAGR computed from simulation
      buys,                // Number of buy actions
      sells                // Number of sell actions
    } = JSON.parse(event.body);

    if (!documentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing documentId in payload.' }),
      };
    }

    // Build the update object for the post update
    const updateData = {
      hasStarted,
      naturalEnd,
      valid,
      endGameDate: new Date(endGameDate), // ensure it's a Date
      durationOfGame,
      portfolioValue,
      buyHoldFinalValue,
      portfolioCAGR,
      buyHoldCAGR,
      buys,
      sells
    };

    // Update the visitor document with the post simulation fields
    const result = await visitorsCollection.updateOne(
      { _id: documentId },
      { $set: updateData }
    );

    if (result.modifiedCount === 1) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Visitor document updated successfully.' }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to update visitor document.' }),
      };
    }
  } catch (error) {
    console.error('Error in updateVisitorDocument function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};