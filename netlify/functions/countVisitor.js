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

// Hash the IP address using SHA-256.
const hashIP = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex');
};

// Extract the user's IP address from the request headers.
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

    // Determine the correct database name based on deploy context.
    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');

    // Get the user's IP and hash it.
    const userIP = getUserIP(event);
    const visitorFingerprint = hashIP(userIP);

    // Look for an existing document with this visitorFingerprint.
    const existingDoc = await visitorsCollection.findOne({ visitorFingerprint });

    if (existingDoc) {
      // Visitor already exists – do nothing further.
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Visitor already exists.', visitorId: existingDoc._id }),
      };
    } else {
      // Visitor not found – insert a new document.
      const now = new Date();
      const newDoc = {
        visitorFingerprint,
        visitDate: now
      };

      const insertResult = await visitorsCollection.insertOne(newDoc);
      if (insertResult.acknowledged) {
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'New visitor added.', visitorId: insertResult.insertedId }),
        };
      } else {
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Failed to add visitor.' }),
        };
      }
    }
  } catch (error) {
    console.error('Error in countVisitor function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};