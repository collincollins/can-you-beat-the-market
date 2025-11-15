// netlify/functions/updateVisitorDocument.js

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { safeParseJSON, createBadRequestResponse } = require('./utils/parseJSON');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
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
    // SECURITY FIX: Safely parse JSON with proper error handling
    const parseResult = safeParseJSON(event.body);
    if (!parseResult.success) {
      return createBadRequestResponse(parseResult.error);
    }

    const payload = parseResult.data;

    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const defaultDbName =
      process.env.CONTEXT === 'branch-deploy'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');

    const {
      documentId,
      hasStarted,
      naturalEnd,
      valid,
      win,
      winStreak,
      endGameDate,
      durationOfGame,
      portfolioValue,
      buyHoldFinalValue,
      portfolioCAGR,
      buyHoldCAGR,
      buys,
      sells,
      realMode,
      startRealMarketDate,
      endRealMarketDate
    } = payload;

    if (!documentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing documentId in payload.' }),
      };
    }

    // convert documentId string to an ObjectId
    const filter = { _id: new ObjectId(documentId) };

    const updateData = {
      hasStarted,
      naturalEnd,
      valid,
      win,
      winStreak,
      endGameDate: new Date(endGameDate),
      durationOfGame,
      portfolioValue,
      buyHoldFinalValue,
      portfolioCAGR,
      buyHoldCAGR,
      buys,
      sells,
      realMode,
      ...(startRealMarketDate && { startRealMarketDate: new Date(startRealMarketDate) }),
      ...(endRealMarketDate && { endRealMarketDate: new Date(endRealMarketDate) }),
    };

    const result = await visitorsCollection.updateOne(
      filter,
      { $set: updateData }
    );

    
    if (result.modifiedCount === 1) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Visitor document updated successfully.' }),
      };
    } else {
      console.error('Failed to update visitor document:', result);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to update visitor document.' }),
      };
    }
  } catch (error) {
    console.error('Error in updateVisitorDocument function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};