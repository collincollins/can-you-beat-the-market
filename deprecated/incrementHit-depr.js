// netlify/functions/incrementHit.js

const { MongoClient, ServerApiVersion, ReturnDocument } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
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
    console.log("Function 'incrementHit' invoked.");

    if (!isConnected) {
      console.log("Connecting to MongoDB...");
      await client.connect();
      isConnected = true;
      console.log("Connected to MongoDB.");
    }

    const defaultDbName = process.env.CONTEXT === 'deploy-preview'
    ? 'canyoubeatthemarket-test'
    : 'canyoubeatthemarket';
  
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const hitsCollection = database.collection('hits');

    const hit = await hitsCollection.findOneAndUpdate(
      { _id: 'hitCounter' },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: ReturnDocument.AFTER }
    );

    console.log('Hit object:', hit);

    // Adjusted to access 'hit.count' directly
    const updatedCount = hit.value ? hit.value.count : hit.count;

    if (updatedCount === undefined) {
      throw new Error('Failed to retrieve updated hit count.');
    }

    console.log(`Hit count updated to: ${updatedCount}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ count: updatedCount }),
    };
  } catch (error) {
    console.error('Error in incrementHit function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};