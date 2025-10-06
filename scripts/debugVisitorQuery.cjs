// Debug script to test the getVisitorDocuments query
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://collincollins:UD1vcKj0cjFWEUK8@canyoubeatthemarketclus.jfny6py.mongodb.net/?retryWrites=true&w=majority&appName=canyoubeatthemarketcluster";

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, deprecationErrors: true },
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
});

async function testQuery() {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('✓ Connected successfully\n');

    const database = client.db('canyoubeatthemarket');
    const visitorsCollection = database.collection('visitors');
    const chartDataCacheCollection = database.collection('chartDataCache');

    // Test both realMode true and false
    for (const realMode of [true, false]) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Testing ${realMode ? 'REAL' : 'SIMULATED'} MODE`);
      console.log('='.repeat(70));

      const cacheId = realMode ? 'realMode' : 'simulatedMode';
      
      // Check cache
      console.log('\n1. Checking cache...');
      const cachedData = await chartDataCacheCollection.findOne({ _id: cacheId });
      if (cachedData) {
        console.log(`   ✓ Cache found, updated: ${cachedData.updatedAt}`);
        console.log(`   Cache has ${cachedData.totalGames} games`);
        const age = (Date.now() - new Date(cachedData.updatedAt).getTime()) / (1000 * 60);
        console.log(`   Cache age: ${age.toFixed(1)} minutes`);
        console.log(`   Cache valid: ${age < 360 ? 'YES' : 'NO (stale)'}`);
      } else {
        console.log('   ✗ No cache found');
      }

      let pipeline = [];
      if (realMode) {
        pipeline = [
          {
            $match: {
              durationOfGame: { $gte: 10 },
              buys: { $exists: true },
              sells: { $exists: true },
              portfolioCAGR: { $exists: true },
              buyHoldCAGR: { $exists: true },
              realMode: true,
              startRealMarketDate: { $exists: true, $nin: [null, 0] },
              endRealMarketDate: { $exists: true, $nin: [null, 0] }
            }
          },
          {
            $addFields: {
              totalTrades: {
                $add: [
                  { $ifNull: ["$buys", 0] },
                  { $ifNull: ["$sells", 0] }
                ]
              }
            }
          },
          {
            $match: {
              totalTrades: { $gt: 2, $lte: 25 }
            }
          },
          {
            $project: {
              _id: 1,
              portfolioCAGR: 1,
              buyHoldCAGR: 1,
              totalTrades: 1
            }
          }
        ];
      } else {
        pipeline = [
          {
            $match: {
              durationOfGame: { $gte: 10 },
              buys: { $exists: true },
              sells: { $exists: true },
              portfolioCAGR: { $exists: true },
              buyHoldCAGR: { $exists: true },
              $or: [
                { realMode: { $exists: false } },
                { realMode: false }
              ]
            }
          },
          {
            $addFields: {
              totalTrades: {
                $add: [
                  { $ifNull: ["$buys", 0] },
                  { $ifNull: ["$sells", 0] }
                ]
              }
            }
          },
          {
            $match: {
              totalTrades: { $gt: 2, $lte: 25 },
            }
          },
          {
            $project: {
              _id: 1,
              portfolioCAGR: 1,
              buyHoldCAGR: 1,
              totalTrades: 1
            }
          }
        ];
      }

      // Test the query with timing
      console.log('\n2. Running aggregation query...');
      const startTime = Date.now();
      
      try {
        const visitorDocs = await visitorsCollection
          .aggregate(pipeline, { maxTimeMS: 25000 })
          .toArray();
        
        const duration = Date.now() - startTime;
        console.log(`   ✓ Query completed in ${duration}ms`);
        console.log(`   Found ${visitorDocs.length} documents`);
        
        if (visitorDocs.length > 0) {
          console.log(`   Sample document:`, {
            _id: visitorDocs[0]._id,
            portfolioCAGR: visitorDocs[0].portfolioCAGR,
            buyHoldCAGR: visitorDocs[0].buyHoldCAGR,
            totalTrades: visitorDocs[0].totalTrades
          });
        }

        // Check if query would time out in Netlify (26 second limit)
        if (duration > 20000) {
          console.log(`   ⚠️  WARNING: Query took ${duration}ms - may timeout in Netlify!`);
        } else if (duration > 10000) {
          console.log(`   ⚠️  Query is slow (${duration}ms) but should work`);
        } else if (duration > 5000) {
          console.log(`   ✓ Query is acceptable (${duration}ms)`);
        } else {
          console.log(`   ✓ Query is fast! (${duration}ms)`);
        }

      } catch (queryError) {
        const duration = Date.now() - startTime;
        console.log(`   ✗ Query FAILED after ${duration}ms`);
        console.log(`   Error: ${queryError.message}`);
        console.log(`   Error name: ${queryError.name}`);
        console.log(`   Error code: ${queryError.code}`);
      }

      // Check indexes
      console.log('\n3. Checking indexes...');
      const indexes = await visitorsCollection.indexes();
      console.log(`   Total indexes: ${indexes.length}`);
      
      const relevantIndexes = indexes.filter(idx => 
        idx.key.durationOfGame || idx.key.realMode
      );
      
      if (relevantIndexes.length > 0) {
        console.log('   Relevant indexes for this query:');
        relevantIndexes.forEach(idx => {
          console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
      } else {
        console.log('   ⚠️  WARNING: No indexes found on durationOfGame!');
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('Debug complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n✗ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
  } finally {
    await client.close();
    console.log('\nConnection closed.');
  }
}

testQuery();

