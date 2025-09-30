// netlify/functions/getUserStats.js

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

    // Get username from query parameter
    const username = event.queryStringParameters?.username;

    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username parameter required' }),
      };
    }

    // Find user
    const user = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    // Get all games for this user
    const games = await visitorsCollection.find({ userId: user.userId }).toArray();

    // Calculate stats
    const validGames = games.filter(g => g.valid === true);
    const wins = validGames.filter(g => g.win === true);
    
    const stats = {
      username: user.username,
      userId: user.userId,
      accountCreated: user.createdAt,
      totalGames: games.length,
      validGames: validGames.length,
      wins: wins.length,
      winRate: validGames.length > 0 ? (wins.length / validGames.length * 100).toFixed(2) : 0,
      avgExcessCAGR: validGames.length > 0 
        ? (validGames.reduce((sum, g) => sum + (g.portfolioCAGR - g.buyHoldCAGR), 0) / validGames.length).toFixed(2)
        : 0,
      bestExcessCAGR: validGames.length > 0
        ? Math.max(...validGames.map(g => g.portfolioCAGR - g.buyHoldCAGR)).toFixed(2)
        : 0,
      worstExcessCAGR: validGames.length > 0
        ? Math.min(...validGames.map(g => g.portfolioCAGR - g.buyHoldCAGR)).toFixed(2)
        : 0,
      avgTrades: validGames.length > 0
        ? (validGames.reduce((sum, g) => sum + (g.buys + g.sells), 0) / validGames.length).toFixed(2)
        : 0,
      recentGames: games.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)).slice(0, 10)
    };

    return {
      statusCode: 200,
      body: JSON.stringify(stats),
    };
  } catch (error) {
    console.error('Error in getUserStats function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
