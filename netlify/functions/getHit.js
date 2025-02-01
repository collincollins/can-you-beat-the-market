// netlify/functions/getHit.js

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

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    console.log("Function 'getHit' invoked.");

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

    const hit = await hitsCollection.findOne({ _id: 'hitCounter' });

    const count = hit ? hit.count : 0;

    console.log(`Retrieved hit count: ${count}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ count }),
    };
  } catch (error) {
    console.error('Error in getHit function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};