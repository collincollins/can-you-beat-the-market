// netlify/functions/getHighScore.js

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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    console.log("Function 'getHighScore' invoked.");

    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const database = client.db('canyoubeatthemarket');
    const highScoreCollection = database.collection('highScores');

    // Find the doc with the highest score
    const topScoreDoc = await highScoreCollection
      .find({})
      .sort({ score: -1 })      // Sort descending by score
      .limit(1)                // Take only the top result
      .toArray();

    if (!topScoreDoc[0]) {
      // No scores in DB
      return {
        statusCode: 200,
        body: JSON.stringify({ score: 0, playerName: 'No one yet' }),
      };
    }

    const { score, playerName } = topScoreDoc[0];
    return {
      statusCode: 200,
      body: JSON.stringify({ score, playerName }),
    };
  } catch (error) {
    console.error('Error in getHighScore function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};