// scripts/clearLeaderboardCache.cjs
// Run this script to clear the leaderboard cache and force a refresh

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

if (!uri) {
  console.error('Missing MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET environment variable');
  process.exit(1);
}

const client = new MongoClient(uri);

async function clearLeaderboardCache() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const dbName = process.env.MONGODB_DB_NAME || 'canyoubeatthemarket';
    const database = client.db(dbName);
    console.log(`Using database: ${dbName}`);
    
    const leaderboardCacheCollection = database.collection('leaderboardCache');
    
    // Delete all cached leaderboard data
    const result = await leaderboardCacheCollection.deleteMany({});
    
    console.log(`✓ Cleared ${result.deletedCount} leaderboard cache entries`);
    console.log('\nCache cleared! The leaderboard will regenerate on next request.');
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

clearLeaderboardCache();

