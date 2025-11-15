// netlify/functions/setHighScore.js

const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');
const { validatePlayerName, validateScore, validateUserId } = require('./utils/sanitize');
const { safeParseJSON, createBadRequestResponse } = require('./utils/parseJSON');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
});

let isConnected = false;

// function to extract the user's IP from request headers.
const getUserIP = (event) => {
  const headers = event.headers;
  return headers['x-nf-client-connection-ip'] || headers['x-real-ip'] || '0.0.0.0';
};

// function to hash the IP address using SHA-256.
const hashIP = (ip) => {
  const salt = process.env.VISITOR_SALT;
  if (!salt) {
    throw new Error('Missing environment variable: VISITOR_SALT');
  }
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // SECURITY FIX: Safely parse JSON
    const parseResult = safeParseJSON(event.body);
    if (!parseResult.success) {
      return createBadRequestResponse(parseResult.error);
    }

    const { playerName, score, userId } = parseResult.data;

    console.log('Received high score submission.');

    // SECURITY FIX: Comprehensive input validation with sanitization
    const playerNameValidation = validatePlayerName(playerName);
    if (!playerNameValidation.valid) {
      console.log('Player name validation failed:', playerNameValidation.error);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: playerNameValidation.error }),
      };
    }

    const scoreValidation = validateScore(score);
    if (!scoreValidation.valid) {
      console.log('Score validation failed:', scoreValidation.error);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: scoreValidation.error }),
      };
    }

    const userIdValidation = validateUserId(userId);
    if (!userIdValidation.valid) {
      console.log('UserId validation failed:', userIdValidation.error);
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Must be logged in to submit high score.' }),
      };
    }

    // Use sanitized player name
    const sanitizedPlayerName = playerNameValidation.sanitized;

    // connect to MongoDB if not already connected.
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    // determine the database name based on deploy context.
    const defaultDbName = process.env.CONTEXT === 'deploy-preview'
      ? 'canyoubeatthemarket-test'
      : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);

    // get and hash the user's IP address.
    const visitorIP = getUserIP(event);
    const visitorFingerprint = hashIP(visitorIP);

    // validate that the visitor has enough actual wins to support this score.
    const visitorsCollection = database.collection('visitors');
    const actualWins = await visitorsCollection.countDocuments({
      visitorFingerprint: visitorFingerprint,
      valid: true,
      win: true
    });

    if (score > actualWins) {
      console.log(`Score validation failed: claimed ${score}, actual wins ${actualWins}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Score exceeds actual game wins.' }),
      };
    }

    // 1. update the current high score document in the "currentHighScore" collection.
    const currentHighScoreCollection = database.collection('currentHighScore');

    const updateResult = await currentHighScoreCollection.updateOne(
      { _id: 'current' },
      {
        $set: {
          updatedAt: new Date(),
          playerName: sanitizedPlayerName,  // SECURITY FIX: Use sanitized name
          userId: userId,
          visitorFingerprint: visitorFingerprint  // save hashed IP here.
        },
        $max: { score: score },
        $setOnInsert: { _id: 'current', createdAt: new Date() }
      },
      { upsert: true }
    );

    // 2. append a history log in the "highScoreHistory" collection.
    const highScoreHistoryCollection = database.collection('highScoreHistory');
    await highScoreHistoryCollection.insertOne({
      playerName: sanitizedPlayerName,  // SECURITY FIX: Use sanitized name
      score,
      userId: userId,
      visitorFingerprint: visitorFingerprint,  // save hashed IP for history as well.
      submittedAt: new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'High score updated and history recorded successfully.' }),
    };
  } catch (error) {
    console.error('Error in setHighScore function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};