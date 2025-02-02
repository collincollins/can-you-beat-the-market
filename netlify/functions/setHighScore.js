// netlify/functions/setHighScore.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
});

let isConnected = false;

// Function to extract the user's IP from request headers.
const getUserIP = (event) => {
  const headers = event.headers;
  return headers['x-nf-client-connection-ip'] || headers['x-real-ip'] || '0.0.0.0';
};

// Function to hash the IP address using SHA-256.
const hashIP = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex');
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // Parse the incoming data.
    const data = JSON.parse(event.body);
    const { playerName, score } = data;

    console.log('Received high score submission:', data);

    // Validate input.
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

    // Connect to MongoDB if not already connected.
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // Determine the database name based on deploy context.
    const defaultDbName = process.env.CONTEXT === 'deploy-preview'
      ? 'canyoubeatthemarket-test'
      : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);

    // Get and hash the user's IP address.
    const visitorIP = getUserIP(event);
    const visitorFingerprint = hashIP(visitorIP);

    // 1. Update the current high score document in the "currentHighScore" collection.
    const currentHighScoreCollection = database.collection('currentHighScore');

    const updateResult = await currentHighScoreCollection.updateOne(
      { _id: 'current' },
      {
        $set: {
          updatedAt: new Date(),
          playerName: playerName.trim(),
          visitorFingerprint: visitorFingerprint  // Save hashed IP here.
        },
        $max: { score: score },
        $setOnInsert: { _id: 'current', createdAt: new Date() }
      },
      { upsert: true }
    );

    // 2. Append a history log in the "highScoreHistory" collection.
    const highScoreHistoryCollection = database.collection('highScoreHistory');
    await highScoreHistoryCollection.insertOne({
      playerName: playerName.trim(),
      score,
      visitorFingerprint: visitorFingerprint,  // Save hashed IP for history as well.
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