// scripts/createIndexesTest.cjs
// Run this script once to create optimal MongoDB indexes in TEST database

const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://collincollins:UD1vcKj0cjFWEUK8@canyoubeatthemarket-tes.du4wmzc.mongodb.net/?retryWrites=true&w=majority&appName=canyoubeatthemarket-test";

const client = new MongoClient(uri);

async function createIndexes() {
  try {
    await client.connect();
    console.log('Connected to MongoDB (TEST CLUSTER)');

    const database = client.db('canyoubeatthemarket-test');
    
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
    
    // Indexes for chart data aggregation queries (getVisitorDocuments function)
    // These are critical for performance when filtering games for chart display
    await visitorsCollection.createIndex({ 
      durationOfGame: 1, 
      realMode: 1, 
      buys: 1, 
      sells: 1 
    });
    await visitorsCollection.createIndex({ 
      durationOfGame: 1, 
      buys: 1, 
      sells: 1, 
      portfolioCAGR: 1, 
      buyHoldCAGR: 1 
    });
    
    console.log('✓ Created indexes on visitors collection');

    console.log('\nAll indexes created successfully on TEST CLUSTER!');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await client.close();
  }
}

createIndexes();

