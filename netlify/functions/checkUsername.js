// netlify/functions/checkUsername.js

const { MongoClient, ServerApiVersion } = require('mongodb');

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

    const { username } = JSON.parse(event.body);

    if (!username || typeof username !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid username' }),
      };
    }

    // Check if username exists (case-insensitive)
    const existingUser = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ exists: !!existingUser }),
    };
  } catch (error) {
    console.error('Error in checkUsername function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
