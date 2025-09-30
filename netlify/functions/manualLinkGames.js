// netlify/functions/manualLinkGames.js
// Manual function to link games to a user - useful for fixing existing data

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
    const usersCollection = database.collection('users');
    const visitorsCollection = database.collection('visitors');

    const { username } = JSON.parse(event.body);

    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username required' }),
      };
    }

    // Find the user
    const user = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    // Link all games with the user's visitorFingerprint that don't have a userId
    const result = await visitorsCollection.updateMany(
      { 
        visitorFingerprint: user.visitorFingerprint,
        $or: [
          { userId: { $exists: false } },
          { userId: null }
        ]
      },
      { $set: { userId: user.userId, linkedAt: new Date() } }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Games linked successfully',
        username: user.username,
        userId: user.userId,
        gamesLinked: result.modifiedCount
      }),
    };
  } catch (error) {
    console.error('Error in manualLinkGames function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};
