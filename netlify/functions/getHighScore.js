// netlify/functions/getHighScore.js

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

    const defaultDbName = process.env.CONTEXT === 'deploy-preview'
      ? 'canyoubeatthemarket-test'
      : 'canyoubeatthemarket';

    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);

    // Query the "currentHighScore" collection for the current high score.
    const currentHighScoreCollection = database.collection('currentHighScore');
    const currentScoreDoc = await currentHighScoreCollection.findOne({ _id: 'current' });

    if (!currentScoreDoc) {
      return {
        statusCode: 200,
        body: JSON.stringify({ score: 0, playerName: 'No one yet' }),
      };
    }

    // Return the high score and the player name.
    const { score, playerName } = currentScoreDoc;
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