// netlify/functions/setHighScore.js

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
    console.log("Function 'setHighScore' invoked.");

    if (!isConnected) {
      console.log("Connecting to MongoDB...");
      await client.connect();
      isConnected = true;
      console.log("Connected to MongoDB.");
    }

    const database = client.db('dontbuythat');
    const highScoreCollection = database.collection('highScores');

    const { playerName, score } = JSON.parse(event.body);

    if (typeof playerName !== 'string' || typeof score !== 'number') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid input data.' }),
      };
    }

    const updateResult = await highScoreCollection.updateOne(
      { _id: 'highScore' },
      { $set: { playerName, score } },
      { upsert: true }
    );

    console.log(`High score updated to ${score} by ${playerName}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'High score updated successfully.' }),
    };
  } catch (error) {
    console.error('Error in setHighScore function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};