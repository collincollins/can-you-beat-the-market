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
    // SECURITY FIX: Use server-side API key instead of client-supplied query parameter
    // The admin API key should be set as an environment variable
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
    const visitorsCollection = database.collection('visitors');

    // Get all users with game counts in single aggregation (avoids N+1 query problem)
    const usersWithCounts = await usersCollection.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $lookup: {
          from: 'visitors',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$valid', true] }
                  ]
                }
              }
            },
            {
              $count: 'count'
            }
          ],
          as: 'gameStats'
        }
      },
      {
        $project: {
          username: 1,
          userId: 1,
          createdAt: { $ifNull: ['$firstGameDate', '$createdAt'] },
          validGames: {
            $ifNull: [{ $arrayElemAt: ['$gameStats.count', 0] }, 0]
          }
        }
      }
    ]).toArray();

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
