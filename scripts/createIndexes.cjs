// scripts/createIndexes.js
// Run this script once to create optimal MongoDB indexes

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

if (!uri) {
  console.error('Missing MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET environment variable');
  process.exit(1);
}

const client = new MongoClient(uri);

async function createIndexes() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db('canyoubeatthemarket');
    
    // Users collection indexes
    const usersCollection = database.collection('users');
    await usersCollection.createIndex(
      { username: 1 }, 
      { unique: true, collation: { locale: 'en', strength: 2 } }
    );
    await usersCollection.createIndex({ userId: 1 }, { unique: true });
    console.log('✓ Created indexes on users collection');

    // Visitors collection indexes
    const visitorsCollection = database.collection('visitors');
    await visitorsCollection.createIndex({ userId: 1 });
    await visitorsCollection.createIndex({ visitorFingerprint: 1 });
    await visitorsCollection.createIndex({ valid: 1 });
    await visitorsCollection.createIndex({ valid: 1, realMode: 1 });
    await visitorsCollection.createIndex({ hasStarted: 1 });
    console.log('✓ Created indexes on visitors collection');

    console.log('\nAll indexes created successfully!');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await client.close();
  }
}

createIndexes();
