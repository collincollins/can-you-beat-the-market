// netlify/functions/createUser.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Simple profanity filter
const badWords = ['fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'piss', 'dick', 'cock', 'pussy', 'slut', 'whore', 'fag', 'nigger', 'nigga', 'cunt', 'twat', 'retard'];
const isProfane = (text) => {
  const lower = text.toLowerCase();
  return badWords.some(word => lower.includes(word));
};

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

    const { username, password, visitorFingerprint } = JSON.parse(event.body);

    if (!username || typeof username !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid username' }),
      };
    }

    // Check for profanity
    if (isProfane(username)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username contains inappropriate language' }),
      };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Password must be at least 6 characters' }),
      };
    }

    // Generate a unique userId
    const userId = crypto.randomUUID();

    // Check if username already exists (case-insensitive)
    const existingUser = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (existingUser) {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: 'Username already exists' }),
      };
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const userDoc = {
      userId,
      username: username.trim(),
      hashedPassword,
      createdAt: new Date(),
      visitorFingerprint: visitorFingerprint || null
    };

    const result = await usersCollection.insertOne(userDoc);

    if (result.acknowledged) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'User created successfully',
          userId,
          username: userDoc.username
        }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to create user' }),
      };
    }
  } catch (error) {
    console.error('Error in createUser function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
