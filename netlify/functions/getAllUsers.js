// netlify/functions/getAllUsers.js
// Admin-only function to get list of all users

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

    // Get requesting username from query
    const requestingUser = event.queryStringParameters?.username;

    // Only allow for user "collin"
    if (requestingUser?.toLowerCase() !== 'collin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden' }),
      };
    }

    // Get all users
    const allUsers = await usersCollection.find({})
      .project({ username: 1, userId: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .toArray();

    // Get game counts for each user
    const usersWithCounts = await Promise.all(
      allUsers.map(async (user) => {
        const gameCount = await visitorsCollection.countDocuments({ 
          userId: user.userId,
          valid: true
        });
        return {
          username: user.username,
          userId: user.userId,
          createdAt: user.createdAt,
          validGames: gameCount
        };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(usersWithCounts),
    };
  } catch (error) {
    console.error('Error in getAllUsers function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
