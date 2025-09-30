// netlify/functions/linkSessionToUser.js

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
    const visitorsCollection = database.collection('visitors');
    const usersCollection = database.collection('users');

    const { userId, visitorFingerprint } = JSON.parse(event.body);

    if (!userId || !visitorFingerprint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing userId or visitorFingerprint' }),
      };
    }

    // Update all documents with this visitorFingerprint that don't have a userId
    // This includes documents where userId is null or doesn't exist
    const result = await visitorsCollection.updateMany(
      { 
        visitorFingerprint, 
        $or: [
          { userId: { $exists: false } },
          { userId: null }
        ]
      },
      { $set: { userId, linkedAt: new Date() } }
    );
    
    // Update user's firstGameDate if we linked any games
    if (result.modifiedCount > 0) {
      // Find the oldest game for this user
      const oldestGame = await visitorsCollection
        .find({ userId })
        .sort({ visitDate: 1 })
        .limit(1)
        .toArray();
      
      if (oldestGame.length > 0 && oldestGame[0].visitDate) {
        await usersCollection.updateOne(
          { userId },
          { $set: { firstGameDate: oldestGame[0].visitDate } }
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Session linked to user successfully',
        documentsUpdated: result.modifiedCount
      }),
    };
  } catch (error) {
    console.error('Error in linkSessionToUser function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
