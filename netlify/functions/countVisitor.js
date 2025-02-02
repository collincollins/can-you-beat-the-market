// netlify/functions/countVisitor.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let isConnected = false;

// Function to hash the IP address using SHA-256
const hashIP = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex');
};

// Function to retrieve the user's IP address from the request
const getUserIP = (event) => {
  const headers = event.headers;
  // In Netlify, the 'x-nf-client-connection-ip' header contains the client's IP
  return headers['x-nf-client-connection-ip'] || headers['x-real-ip'] || '0.0.0.0';
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // Connect to MongoDB if not already connected
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // Determine the default DB name based on deploy context
    const defaultDbName = process.env.CONTEXT === 'deploy-preview'
      ? 'canyoubeatthemarket-test'
      : 'canyoubeatthemarket';

    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');
    const visitorCounterCollection = database.collection('visitorCounter');

    // Get and hash the user's IP address
    const userIP = getUserIP(event);
    const hashedIP = hashIP(userIP);
    const now = new Date();

    // Define the initial visitor document structure
    const initialVisitorDoc = {
      _id: hashedIP,
      firstVisit: now,
      lastVisit: now,
      hasPlayed: false,
      firstGame: null,
      mostRecentGame: null,
      totalGames: 0,
      invalidGames: 0,
      validGames: 0,
      wins: 0,
      losses: 0,
      highestWinStreak: 0,
      averageCAGR: 0,
      highestCAGR: 0,
      avgBuysPerGame: 0,
      avgSellsPerGame: 0,
      totalTimePlaying: 0,
      avgTimePlaying: 0,
      username: null
    };

    // Attempt to insert a new document for this visitor
    const insertResult = await visitorsCollection.insertOne(initialVisitorDoc);

    if (insertResult.acknowledged) {
      // If insertion is successful, increment the visitor counter
      await visitorCounterCollection.updateOne(
        { _id: 'visitorCounter' },
        { $inc: { count: 1 } },
        { upsert: true }
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'New visitor counted.', isNewVisitor: true }),
      };
    }
  } catch (error) {
    // Check for duplicate key error (visitor already exists)
    if (error.code === 11000) {
      // Update the existing visitor document's lastVisit field
      try {
        const defaultDbName = process.env.CONTEXT === 'deploy-preview'
          ? 'canyoubeatthemarket-test'
          : 'canyoubeatthemarket';
        const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
        const database = client.db(dbName);
        const visitorsCollection = database.collection('visitors');

        await visitorsCollection.updateOne(
          { _id: hashIP(getUserIP(event)) },
          { $set: { lastVisit: new Date() } }
        );

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Visitor already exists.', isNewVisitor: false }),
        };
      } catch (updateError) {
        console.error('Error updating visitor document:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Internal Server Error' }),
        };
      }
    } else {
      console.error('Error in countVisitor function:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      };
    }
  }
};