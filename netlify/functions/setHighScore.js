// netlify/functions/setHighScore.js

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
    const data = JSON.parse(event.body);
    const { playerName, score } = data;

    console.log('Received high score submission:', data);

    // Validate input data
    if (
      typeof playerName !== 'string' ||
      playerName.trim() === '' ||
      typeof score !== 'number' ||
      score < 0
    ) {
      console.log('Validation failed for data:', data);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid input data.' }),
      };
    }

    // Connect to MongoDB if not already connected
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // Determine the database name based on deploy context
    const defaultDbName = process.env.CONTEXT === 'deploy-preview'
      ? 'canyoubeatthemarket-test'
      : 'canyoubeatthemarket';
      
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);

    // 1. Atomic High Score Update in the "currentHighScore" collection
    const currentHighScoreCollection = database.collection('currentHighScore');

    // Use upsert with the $max operator so that the current high score is updated only if the new score is higher.
    const updateResult = await currentHighScoreCollection.updateOne(
      { _id: 'current' },
      [
        {
          $set: {
            score: {
              $cond: {
                if: { $lt: [{ $ifNull: ['$score', -1e12] }, score] },
                then: score,
                else: '$score'
              }
            },
            playerName: {
              $cond: {
                if: { $lt: [{ $ifNull: ['$score', -1e12] }, score] },
                then: playerName.trim(),
                else: '$playerName'
              }
            },
            updatedAt: new Date()
          }
        },
        {
          $setOnInsert: { _id: 'current', createdAt: new Date() }
        }
      ],
      { upsert: true }
    );

    // 2. Append-Only History Log in the "highScoreHistory" collection
    const highScoreHistoryCollection = database.collection('highScoreHistory');
    await highScoreHistoryCollection.insertOne({
      playerName: playerName.trim(),
      score,
      submittedAt: new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'High score updated and history recorded successfully.' }),
    };
  } catch (error) {
    console.error('Error in setHighScore function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};