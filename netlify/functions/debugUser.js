// netlify/functions/debugUser.js
// Debug function to check user accounts

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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // SECURITY FIX: Require admin API key for this sensitive debugging function
    const adminApiKey = process.env.ADMIN_API_KEY;
    const providedApiKey = event.headers['x-admin-api-key'] || event.headers['X-Admin-Api-Key'];

    // Verify admin API key is configured
    if (!adminApiKey) {
      console.error('ADMIN_API_KEY environment variable not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Server configuration error' }),
      };
    }

    // Verify the request includes valid admin credentials
    if (!providedApiKey || providedApiKey !== adminApiKey) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden: Invalid or missing admin credentials' }),
      };
    }

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

    const username = event.queryStringParameters?.username;

    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username parameter required' }),
      };
    }

    // Find all users with this username (case-insensitive)
    const users = await usersCollection.find({
      username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') }
    }).toArray();

    return {
      statusCode: 200,
      body: JSON.stringify({
        username,
        totalAccounts: users.length,
        accounts: users.map(u => ({
          userId: u.userId,
          username: u.username,
          createdAt: u.createdAt,
          visitorFingerprint: u.visitorFingerprint
        }))
      }),
    };
  } catch (error) {
    console.error('Error in debugUser function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
