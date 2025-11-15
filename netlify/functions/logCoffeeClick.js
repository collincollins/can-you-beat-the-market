// netlify/functions/logCoffeeClick.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
});

let isConnected = false;

// Function to hash the IP address using SHA-256 with salt
// SECURITY FIX: Add salt to match other functions (createVisitorDocument, setHighScore)
const hashIP = (ip) => {
  const salt = process.env.VISITOR_SALT;
  if (!salt) {
    throw new Error('Missing environment variable: VISITOR_SALT');
  }
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
};

// Function to extract the user's IP address from the request headers.
const getUserIP = (event) => {
  const headers = event.headers;
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
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // Determine the database name based on deploy context.
    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const eventsCollection = database.collection('userEvents');

    // Get user's IP, hash it, and set up the event details.
    const userIP = getUserIP(event);
    const visitorFingerprint = hashIP(userIP);
    const now = new Date();

    // Build the event document.
    const eventDoc = {
      visitorFingerprint,
      eventType: 'coffee_click',
      clickedAt: now,
      ...(event.body ? JSON.parse(event.body) : {}),
    };

    await eventsCollection.insertOne(eventDoc);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Coffee click event recorded.' }),
    };
  } catch (error) {
    console.error('Error in logCoffeeClick function:', error);

    // Check if it's a configuration error
    if (error.message && error.message.includes('VISITOR_SALT')) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Server configuration error' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};