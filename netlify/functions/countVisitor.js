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

    // Attempt to insert the hashed IP into the 'visitors' collection
    const insertResult = await visitorsCollection.insertOne({
      _id: hashedIP,
      firstVisit: new Date(),
    });

    if (insertResult.acknowledged) {
      // If insertion is successful, increment the visitor counter
      const updateResult = await visitorCounterCollection.updateOne(
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
    if (error.code === 11000) {
      // Duplicate key error, IP already exists
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Visitor already exists.', isNewVisitor: false }),
      };
    } else {
      console.error('Error in countVisitor function:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      };
    }
  }
};