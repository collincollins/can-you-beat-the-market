// scripts/copyProdToTest.cjs
// Copies all data from production to test database

const { MongoClient } = require('mongodb');

const prodUri = "mongodb+srv://collincollins:UD1vcKj0cjFWEUK8@canyoubeatthemarketclus.jfny6py.mongodb.net/?retryWrites=true&w=majority&appName=canyoubeatthemarketcluster";
const testUri = "mongodb+srv://collincollins:UD1vcKj0cjFWEUK8@canyoubeatthemarket-tes.du4wmzc.mongodb.net/?retryWrites=true&w=majority&appName=canyoubeatthemarket-test";

async function copyDatabase() {
  const prodClient = new MongoClient(prodUri);
  const testClient = new MongoClient(testUri);

  try {
    console.log('Connecting to production database...');
    await prodClient.connect();
    
    console.log('Connecting to test database...');
    await testClient.connect();

    const prodDb = prodClient.db('canyoubeatthemarket');
    const testDb = testClient.db('canyoubeatthemarket-test');

    // Get all collections from production
    const collections = await prodDb.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections in production:\n`);
    
    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`📦 Processing collection: ${collName}`);
      
      const prodCollection = prodDb.collection(collName);
      const testCollection = testDb.collection(collName);
      
      // Count documents in production
      const count = await prodCollection.countDocuments();
      console.log(`   Production has ${count.toLocaleString()} documents`);
      
      if (count === 0) {
        console.log(`   ⏭️  Skipping empty collection\n`);
        continue;
      }
      
      // Clear test collection first
      const testCount = await testCollection.countDocuments();
      if (testCount > 0) {
        console.log(`   🗑️  Clearing ${testCount.toLocaleString()} existing test documents...`);
        await testCollection.deleteMany({});
      }
      
      // Copy all documents in batches
      const batchSize = 1000;
      let copied = 0;
      
      const cursor = prodCollection.find({});
      let batch = [];
      
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        batch.push(doc);
        
        if (batch.length >= batchSize) {
          await testCollection.insertMany(batch, { ordered: false });
          copied += batch.length;
          console.log(`   ⬆️  Copied ${copied.toLocaleString()} / ${count.toLocaleString()} documents...`);
          batch = [];
        }
      }
      
      // Insert remaining documents
      if (batch.length > 0) {
        await testCollection.insertMany(batch, { ordered: false });
        copied += batch.length;
      }
      
      console.log(`   ✅ Successfully copied ${copied.toLocaleString()} documents\n`);
    }
    
    // Copy indexes for each collection
    console.log('\n📋 Copying indexes...\n');
    for (const collInfo of collections) {
      const collName = collInfo.name;
      
      const prodCollection = prodDb.collection(collName);
      const testCollection = testDb.collection(collName);
      
      const indexes = await prodCollection.indexes();
      
      // Filter out the default _id index
      const customIndexes = indexes.filter(idx => idx.name !== '_id_');
      
      if (customIndexes.length > 0) {
        console.log(`   ${collName}: ${customIndexes.length} custom indexes`);
        
        for (const index of customIndexes) {
          try {
            const { key, ...options } = index;
            delete options.v; // Remove version field
            delete options.ns; // Remove namespace field
            
            await testCollection.createIndex(key, options);
          } catch (err) {
            if (err.code === 85 || err.code === 86) {
              // Index already exists, skip
              console.log(`      Index ${index.name} already exists, skipping`);
            } else {
              console.error(`      Error creating index ${index.name}:`, err.message);
            }
          }
        }
      }
    }
    
    console.log('\n✨ Database copy complete!\n');
    console.log('Summary:');
    console.log(`- Source: canyoubeatthemarket (production cluster)`);
    console.log(`- Destination: canyoubeatthemarket-test (test cluster)`);
    console.log(`- Collections copied: ${collections.length}`);
    
  } catch (error) {
    console.error('\n❌ Error copying database:', error);
    throw error;
  } finally {
    await prodClient.close();
    await testClient.close();
    console.log('\nConnections closed.');
  }
}

copyDatabase();

