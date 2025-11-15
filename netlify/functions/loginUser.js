// netlify/functions/loginUser.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const { safeParseJSON, createBadRequestResponse } = require('./utils/parseJSON');

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

    const { username, password } = parseResult.data;

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

    if (!username || typeof username !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid username' }),
      };
    }

    if (!password || typeof password !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid password' }),
      };
    }

    // Find user (case-insensitive)
    const user = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') }
    });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Invalid username or password' }),
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid username or password' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Login successful',
        userId: user.userId,
        username: user.username
      }),
    };
  } catch (error) {
    console.error('Error in loginUser function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
