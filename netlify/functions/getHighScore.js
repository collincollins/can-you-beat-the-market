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
      console.log("Connecting to MongoDB...");
      await client.connect();
      isConnected = true;
      console.log("Connected to MongoDB.");
    }

    const database = client.db('canyoubeatthemarket');
    const highScoreCollection = database.collection('highScores');

    const highScore = await highScoreCollection.findOne({ _id: 'highScore' });

    const score = highScore ? highScore.score : 0;
    const playerName = highScore ? highScore.playerName : 'No one yet';

    console.log(`Retrieved high score: ${score} by ${playerName}`);

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