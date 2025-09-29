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

    const { userId, visitorFingerprint } = JSON.parse(event.body);

    if (!userId || !visitorFingerprint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing userId or visitorFingerprint' }),
      };
    }

    // Update all documents with this visitorFingerprint to include the userId
    const result = await visitorsCollection.updateMany(
      { visitorFingerprint, userId: { $exists: false } },
      { $set: { userId, linkedAt: new Date() } }
    );

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
