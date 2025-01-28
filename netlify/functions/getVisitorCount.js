// netlify/functions/getVisitorCount.js

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let isConnected = false;

// Handler Function
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // Establish MongoDB Connection if not already connected
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const database = client.db('canyoubeatthemarket');
    const visitorCounterCollection = database.collection('visitorCounter');

    // Retrieve the visitor count
    const visitorCountDoc = await visitorCounterCollection.findOne({ _id: 'visitorCounter' });
    const visitorCount = visitorCountDoc ? visitorCountDoc.count : 0;

    return {
      statusCode: 200,
      body: JSON.stringify({ count: visitorCount }),
    };
  } catch (error) {
    console.error('Error in getVisitorCount function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};