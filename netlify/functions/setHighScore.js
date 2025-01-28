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
    const data = JSON.parse(event.body);
    const { playerName, score } = data;

    console.log("Received data:", data);

    // Validate input data
    if (
      typeof playerName !== 'string' ||
      playerName.trim() === '' ||
      typeof score !== 'number' ||
      score < 0
    ) {
      console.log("Validation failed for data:", data);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid input data.' }),
      };
    }

    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const database = client.db('canyoubeatthemarket');
    const highScoreCollection = database.collection('highScores');

    // Update high score if the new score is higher
    const existingHighScore = await highScoreCollection.findOne({ _id: 'highScore' });

    if (!existingHighScore || score > existingHighScore.score) {
      await highScoreCollection.updateOne(
        { _id: 'highScore' },
        { $set: { score, playerName } },
        { upsert: true }
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'High score updated successfully.' }),
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Score did not exceed the high score.' }),
      };
    }
  } catch (error) {
    console.error('Error in setHighScore function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};