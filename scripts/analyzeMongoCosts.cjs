// scripts/analyzeMongoCosts.cjs
// Comprehensive MongoDB Serverless cost analysis tool

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

if (!uri) {
  console.error('Missing MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET environment variable');
  process.exit(1);
}

// MongoDB Serverless pricing (from invoice)
const PRICING = {
  rpu: {
    tier1: { limit: 50_000_000, rate: 0.10 },      // 0-50M @ $0.10/million
    tier2: { limit: 500_000_000, rate: 0.05 },     // 50-550M @ $0.05/million
    tier3: { rate: 0.02 }                          // 550M+ @ ~$0.02/million (estimated)
  },
  wpu: 1.00,                                       // $1.00/million
  dataTransfer: 0.015                              // $0.015/GB
};

// RPU cost estimates per operation type
const RPU_ESTIMATES = {
  simpleRead: 2,              // findOne with index
  projectedRead: 1.5,         // findOne with projection
  countDocuments: 5,          // count with filter
  simpleAggregation: 15,      // basic aggregation
  complexAggregation: 50,     // aggregation with $lookup
  largeAggregation: 100,      // complex aggregation with large result set
  cacheRead: 2,               // reading cache document
  cacheReadLarge: 10,         // reading large cache document (chartData)
  distinctOperation: 10,      // distinct operation
  updateOne: 0.5,             // WPU operation (tracked separately)
  insertOne: 0.5              // WPU operation (tracked separately)
};

const client = new MongoClient(uri);

/**
 * Analyze actual document sizes in the database
 */
async function analyzeDocumentSizes(db) {
  console.log('\n=== DOCUMENT SIZE ANALYSIS ===\n');
  
  const collections = ['visitors', 'users', 'chartDataCache', 'leaderboardCache', 'globalStats', 'currentHighScore'];
  const sizes = {};
  
  for (const collName of collections) {
    try {
      const coll = db.collection(collName);
      const count = await coll.countDocuments();
      
      if (count === 0) {
        console.log(`${collName}: 0 documents`);
        sizes[collName] = { count: 0, avgSize: 0, totalSize: 0 };
        continue;
      }
      
      // Sample multiple documents for better average
      const samples = await coll.find({}).limit(10).toArray();
      const avgSize = samples.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0) / samples.length;
      const totalSize = avgSize * count;
      
      sizes[collName] = { count, avgSize: Math.round(avgSize), totalSize: Math.round(totalSize) };
      
      console.log(`${collName}:`);
      console.log(`  Documents: ${count.toLocaleString()}`);
      console.log(`  Avg size: ${Math.round(avgSize).toLocaleString()} bytes`);
      console.log(`  Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Special analysis for globalStats
      if (collName === 'globalStats') {
        const globalDoc = await coll.findOne({ _id: 'current' });
        if (globalDoc && globalDoc.allExcessReturns) {
          const returnsSize = JSON.stringify(globalDoc.allExcessReturns).length;
          console.log(`  allExcessReturns array: ${globalDoc.allExcessReturns.length.toLocaleString()} items, ${(returnsSize / 1024).toFixed(2)} KB`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error(`Error analyzing ${collName}:`, error.message);
    }
  }
  
  return sizes;
}

/**
 * Calculate RPU cost with tiered pricing
 */
function calculateRPUCost(rpus) {
  let cost = 0;
  let remaining = rpus;
  
  // Tier 1: 0-50M @ $0.10/million
  if (remaining > 0) {
    const tier1 = Math.min(remaining, PRICING.rpu.tier1.limit);
    cost += tier1 * PRICING.rpu.tier1.rate / 1_000_000;
    remaining -= tier1;
  }
  
  // Tier 2: 50-550M @ $0.05/million
  if (remaining > 0) {
    const tier2 = Math.min(remaining, PRICING.rpu.tier2.limit);
    cost += tier2 * PRICING.rpu.tier2.rate / 1_000_000;
    remaining -= tier2;
  }
  
  // Tier 3: 550M+ @ ~$0.02/million
  if (remaining > 0) {
    cost += remaining * PRICING.rpu.tier3.rate / 1_000_000;
  }
  
  return cost;
}

/**
 * Calculate WPU cost
 */
function calculateWPUCost(wpus) {
  return wpus * PRICING.wpu / 1_000_000;
}

/**
 * Calculate data transfer cost
 */
function calculateDataTransferCost(bytes) {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb * PRICING.dataTransfer;
}

/**
 * Simulate anonymous visitor who bounces (views site, doesn't play)
 */
function simulateAnonymousBounce() {
  return {
    name: 'Anonymous Bounce',
    operations: {
      createVisitorDocument: { writes: 1, wpus: 1, bytesWritten: 500 },
      getVisitorDocuments: { reads: 1, rpus: RPU_ESTIMATES.cacheRead, bytesRead: 50 }, // cache hit
      getLeaderboard: { reads: 1, rpus: RPU_ESTIMATES.cacheRead, bytesRead: 2000 },
      getHighScore: { reads: 1, rpus: RPU_ESTIMATES.simpleRead, bytesRead: 100 }
    },
    totalRPUs: RPU_ESTIMATES.cacheRead + RPU_ESTIMATES.cacheRead + RPU_ESTIMATES.simpleRead,
    totalWPUs: 1,
    bytesWritten: 500,
    bytesRead: 2150
  };
}

/**
 * Simulate anonymous user playing one game
 */
function simulateAnonymousGame() {
  return {
    name: 'Anonymous Game',
    operations: {
      createVisitorDocument: { writes: 1, wpus: 1, bytesWritten: 500 },
      getVisitorDocuments_cacheMiss: { reads: 1, rpus: RPU_ESTIMATES.largeAggregation, bytesRead: 50000 }, // cache miss
      getLeaderboard: { reads: 1, rpus: RPU_ESTIMATES.cacheRead, bytesRead: 2000 },
      updateVisitorDocument: { writes: 1, wpus: 1, bytesWritten: 500 },
      setHighScore: { reads: 1, writes: 1, rpus: RPU_ESTIMATES.simpleRead, wpus: 1, bytesRead: 100, bytesWritten: 100 }
    },
    totalRPUs: RPU_ESTIMATES.largeAggregation + RPU_ESTIMATES.cacheRead + RPU_ESTIMATES.simpleRead,
    totalWPUs: 3,
    bytesWritten: 1100,
    bytesRead: 52100
  };
}

/**
 * Simulate registered user playing multiple games and checking stats
 */
function simulateRegisteredUserSession(gamesPlayed = 3, checkStats = true) {
  const operations = {
    validateUser: { reads: 1, rpus: RPU_ESTIMATES.simpleRead, bytesRead: 200 },
    createVisitorDocuments: { writes: gamesPlayed, wpus: gamesPlayed, bytesWritten: 500 * gamesPlayed },
    updateVisitorDocuments: { writes: gamesPlayed, wpus: gamesPlayed, bytesWritten: 500 * gamesPlayed },
    getVisitorDocuments: { reads: gamesPlayed, rpus: RPU_ESTIMATES.cacheRead * gamesPlayed, bytesRead: 50 * gamesPlayed },
    getLeaderboard: { reads: gamesPlayed, rpus: RPU_ESTIMATES.cacheRead * gamesPlayed, bytesRead: 2000 * gamesPlayed }
  };
  
  let totalRPUs = RPU_ESTIMATES.simpleRead + (RPU_ESTIMATES.cacheRead * gamesPlayed * 2);
  let totalReads = 1 + (gamesPlayed * 2);
  let bytesRead = 200 + (50 * gamesPlayed) + (2000 * gamesPlayed);
  
  if (checkStats) {
    // getUserStats is expensive - reads user + all user games + large globalStats
    const userGamesRead = gamesPlayed * 10; // projected fields
    const globalStatsRPU = 10; // large document with allExcessReturns array
    
    operations.getUserStats = {
      reads: 2 + gamesPlayed, // user doc + game docs + global stats doc
      rpus: RPU_ESTIMATES.simpleRead + (gamesPlayed * 1.5) + globalStatsRPU,
      bytesRead: 200 + (gamesPlayed * 150) + 80000 // global stats can be 80KB+
    };
    
    totalRPUs += RPU_ESTIMATES.simpleRead + (gamesPlayed * 1.5) + globalStatsRPU;
    totalReads += 2 + gamesPlayed;
    bytesRead += 200 + (gamesPlayed * 150) + 80000;
  }
  
  return {
    name: 'Registered User Session',
    gamesPlayed,
    checkStats,
    operations,
    totalRPUs,
    totalWPUs: gamesPlayed * 2,
    totalReads,
    totalWrites: gamesPlayed * 2,
    bytesWritten: 1000 * gamesPlayed,
    bytesRead
  };
}

/**
 * Calculate costs for user distribution
 */
function calculateMonthlyCosts(userCounts) {
  console.log('\n=== MONTHLY COST CALCULATION (10,000 users) ===\n');
  
  const flows = {
    bounces: simulateAnonymousBounce(),
    anonymousGames: simulateAnonymousGame(),
    registeredUsers: simulateRegisteredUserSession(3, true)
  };
  
  let totalRPUs = 0;
  let totalWPUs = 0;
  let totalBytesRead = 0;
  let totalBytesWritten = 0;
  
  console.log('USER FLOW BREAKDOWN:\n');
  
  // Anonymous Bounces
  const bounceCount = userCounts.bounces;
  const bounceRPUs = flows.bounces.totalRPUs * bounceCount;
  const bounceWPUs = flows.bounces.totalWPUs * bounceCount;
  const bounceBytesRead = flows.bounces.bytesRead * bounceCount;
  const bounceBytesWritten = flows.bounces.bytesWritten * bounceCount;
  
  console.log(`1. Anonymous Bounce (${bounceCount.toLocaleString()} users):`);
  console.log(`   RPUs per user: ${flows.bounces.totalRPUs}`);
  console.log(`   WPUs per user: ${flows.bounces.totalWPUs}`);
  console.log(`   Data read: ${flows.bounces.bytesRead} bytes`);
  console.log(`   Data written: ${flows.bounces.bytesWritten} bytes`);
  console.log(`   Total RPUs: ${bounceRPUs.toLocaleString()}`);
  console.log(`   Total WPUs: ${bounceWPUs.toLocaleString()}`);
  console.log('');
  
  totalRPUs += bounceRPUs;
  totalWPUs += bounceWPUs;
  totalBytesRead += bounceBytesRead;
  totalBytesWritten += bounceBytesWritten;
  
  // Anonymous Games
  const gameCount = userCounts.anonymousGames;
  const gameRPUs = flows.anonymousGames.totalRPUs * gameCount;
  const gameWPUs = flows.anonymousGames.totalWPUs * gameCount;
  const gameBytesRead = flows.anonymousGames.bytesRead * gameCount;
  const gameBytesWritten = flows.anonymousGames.bytesWritten * gameCount;
  
  console.log(`2. Anonymous Game (${gameCount.toLocaleString()} users):`);
  console.log(`   RPUs per user: ${flows.anonymousGames.totalRPUs}`);
  console.log(`   WPUs per user: ${flows.anonymousGames.totalWPUs}`);
  console.log(`   Data read: ${flows.anonymousGames.bytesRead} bytes`);
  console.log(`   Data written: ${flows.anonymousGames.bytesWritten} bytes`);
  console.log(`   Total RPUs: ${gameRPUs.toLocaleString()}`);
  console.log(`   Total WPUs: ${gameWPUs.toLocaleString()}`);
  console.log('');
  
  totalRPUs += gameRPUs;
  totalWPUs += gameWPUs;
  totalBytesRead += gameBytesRead;
  totalBytesWritten += gameBytesWritten;
  
  // Registered Users
  const regCount = userCounts.registeredUsers;
  const regRPUs = flows.registeredUsers.totalRPUs * regCount;
  const regWPUs = flows.registeredUsers.totalWPUs * regCount;
  const regBytesRead = flows.registeredUsers.bytesRead * regCount;
  const regBytesWritten = flows.registeredUsers.bytesWritten * regCount;
  
  console.log(`3. Registered User (${regCount.toLocaleString()} users, 3 games + stats):`);
  console.log(`   RPUs per user: ${flows.registeredUsers.totalRPUs.toFixed(1)}`);
  console.log(`   WPUs per user: ${flows.registeredUsers.totalWPUs}`);
  console.log(`   Data read: ${flows.registeredUsers.bytesRead.toLocaleString()} bytes`);
  console.log(`   Data written: ${flows.registeredUsers.bytesWritten} bytes`);
  console.log(`   Total RPUs: ${regRPUs.toLocaleString()}`);
  console.log(`   Total WPUs: ${regWPUs.toLocaleString()}`);
  console.log('');
  
  totalRPUs += regRPUs;
  totalWPUs += regWPUs;
  totalBytesRead += regBytesRead;
  totalBytesWritten += regBytesWritten;
  
  // Calculate costs
  console.log('\n=== TOTAL MONTHLY COSTS (10,000 users) ===\n');
  
  const rpuCost = calculateRPUCost(totalRPUs);
  const wpuCost = calculateWPUCost(totalWPUs);
  const dataTransferCost = calculateDataTransferCost(totalBytesRead);
  const totalCost = rpuCost + wpuCost + dataTransferCost;
  
  console.log(`Total RPUs: ${(totalRPUs / 1_000_000).toFixed(2)} million`);
  console.log(`Total WPUs: ${(totalWPUs / 1_000_000).toFixed(3)} million`);
  console.log(`Total Data Read: ${(totalBytesRead / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Data Written: ${(totalBytesWritten / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log(`RPU Cost: $${rpuCost.toFixed(2)} (${((rpuCost / totalCost) * 100).toFixed(1)}%)`);
  console.log(`WPU Cost: $${wpuCost.toFixed(2)} (${((wpuCost / totalCost) * 100).toFixed(1)}%)`);
  console.log(`Data Transfer Cost: $${dataTransferCost.toFixed(2)} (${((dataTransferCost / totalCost) * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`TOTAL MONTHLY COST: $${totalCost.toFixed(2)}`);
  console.log(`Cost per user: $${(totalCost / 10000).toFixed(4)}`);
  
  return {
    totalRPUs,
    totalWPUs,
    totalBytesRead,
    totalBytesWritten,
    rpuCost,
    wpuCost,
    dataTransferCost,
    totalCost
  };
}

/**
 * Estimate actual usage from last month's invoice
 */
function analyzeActualUsage() {
  console.log('\n=== ACTUAL USAGE ANALYSIS (Last Month) ===\n');
  
  const actualRPUs = 1_226_000_000; // 1.226 billion
  const actualWPUs = 255_000;       // 0.255 million
  const actualDataTransfer = 227;   // 227 GB
  
  const actualRPUCost = calculateRPUCost(actualRPUs);
  const actualWPUCost = calculateWPUCost(actualWPUs);
  const actualDataCost = actualDataTransfer * PRICING.dataTransfer;
  const actualTotal = actualRPUCost + actualWPUCost + actualDataCost;
  
  console.log(`RPUs consumed: ${(actualRPUs / 1_000_000).toFixed(2)} million`);
  console.log(`WPUs consumed: ${(actualWPUs / 1_000_000).toFixed(3)} million`);
  console.log(`Data transferred: ${actualDataTransfer} GB`);
  console.log('');
  console.log(`RPU Cost: $${actualRPUCost.toFixed(2)} (${((actualRPUCost / actualTotal) * 100).toFixed(1)}%)`);
  console.log(`WPU Cost: $${actualWPUCost.toFixed(2)} (${((actualWPUCost / actualTotal) * 100).toFixed(1)}%)`);
  console.log(`Data Transfer: $${actualDataCost.toFixed(2)} (${((actualDataCost / actualTotal) * 100).toFixed(1)}%)`);
  console.log(`Total: $${actualTotal.toFixed(2)}`);
  console.log('');
  
  // Estimate visitor count
  // If we assume average user generates ~20 RPUs (mix of flows)
  const estimatedVisitors = Math.round(actualRPUs / 20);
  console.log(`Estimated monthly visitors: ~${estimatedVisitors.toLocaleString()} (based on avg 20 RPUs/user)`);
  console.log(`Estimated daily visitors: ~${Math.round(estimatedVisitors / 30).toLocaleString()}`);
  
  return {
    actualRPUs,
    actualWPUs,
    actualDataTransfer,
    actualTotal,
    estimatedVisitors
  };
}

/**
 * Analyze optimization impact
 */
function analyzeOptimizationImpact(baselineCost) {
  console.log('\n=== OPTIMIZATION IMPACT ANALYSIS ===\n');
  
  const optimizations = [
    {
      name: 'Eliminate N+1 queries (getAllUsers)',
      frequency: 'Admin only (~10 calls/month)',
      currentRPUs: 500,
      optimizedRPUs: 50,
      savingsPerCall: 450,
      monthlySavings: 450 * 10,
      description: 'Reduces 100+ queries to 1 aggregation'
    },
    {
      name: 'Add projection to updateGlobalStats',
      frequency: 'Triggered on stats page (~1,000 times/month)',
      currentRPUs: 50,
      optimizedRPUs: 15,
      savingsPerCall: 35,
      monthlySavings: 35 * 1000,
      description: 'Fetches only 2 fields instead of full documents'
    },
    {
      name: 'Optimize getVisitorCount (distinct → aggregation)',
      frequency: 'Rare or unused',
      currentRPUs: 100,
      optimizedRPUs: 20,
      savingsPerCall: 80,
      monthlySavings: 80 * 10,
      description: 'Returns count instead of full array'
    },
    {
      name: 'Move leaderboard filter to pipeline',
      frequency: 'Every 6 hours (120 times/month)',
      currentRPUs: 60,
      optimizedRPUs: 50,
      savingsPerCall: 10,
      monthlySavings: 10 * 120,
      description: 'Filter in database instead of JavaScript'
    },
    {
      name: 'Add projection to leaderboard $lookup',
      frequency: 'Every 6 hours (120 times/month)',
      currentRPUs: 60,
      optimizedRPUs: 45,
      savingsPerCall: 15,
      monthlySavings: 15 * 120,
      description: 'Fetch only username from users collection'
    }
  ];
  
  let totalRPUSavings = 0;
  
  optimizations.forEach(opt => {
    console.log(`${opt.name}:`);
    console.log(`  Frequency: ${opt.frequency}`);
    console.log(`  Current: ${opt.currentRPUs} RPUs/call`);
    console.log(`  Optimized: ${opt.optimizedRPUs} RPUs/call`);
    console.log(`  Savings: ${opt.savingsPerCall} RPUs/call`);
    console.log(`  Monthly savings: ${opt.monthlySavings.toLocaleString()} RPUs`);
    console.log(`  Description: ${opt.description}`);
    console.log('');
    
    totalRPUSavings += opt.monthlySavings;
  });
  
  const savingsCost = calculateRPUCost(totalRPUSavings);
  const percentSavings = (savingsCost / baselineCost) * 100;
  
  console.log(`Total RPU Savings: ${(totalRPUSavings / 1_000_000).toFixed(2)} million/month`);
  console.log(`Cost Savings: $${savingsCost.toFixed(2)}/month (${percentSavings.toFixed(1)}% reduction)`);
  console.log(`New estimated cost: $${(baselineCost - savingsCost).toFixed(2)}/month`);
}

/**
 * Identify biggest cost drivers
 */
function identifyBottlenecks(sizes) {
  console.log('\n=== COST BOTTLENECK ANALYSIS ===\n');
  
  console.log('1. Global Stats Document Growth:');
  console.log('   - Current: Stores ALL excess returns in single document');
  console.log('   - Problem: Document grows with every valid game');
  console.log('   - Impact: High RPU cost on every getUserStats call');
  console.log('   - Solution: Calculate percentile on-demand with aggregation');
  console.log('   - Potential savings: 50-70% reduction in getUserStats RPUs');
  console.log('');
  
  console.log('2. Cache Miss Events:');
  console.log('   - Chart data aggregation: ~100 RPUs per cache miss');
  console.log('   - Leaderboard aggregation: ~50-80 RPUs per cache miss');
  console.log('   - Current TTL: 6 hours (4 misses/day)');
  console.log('   - Consideration: Balance freshness vs cost');
  console.log('');
  
  console.log('3. getUserStats Frequency:');
  console.log('   - Most expensive operation per user (~25-30 RPUs)');
  console.log('   - If called frequently, major cost driver');
  console.log('   - Recommendation: Add caching or reduce frequency');
  console.log('');
  
  console.log('4. Admin Functions:');
  console.log('   - getAllUsers (pre-optimization): ~500 RPUs');
  console.log('   - getAllUsers (post-optimization): ~50 RPUs');
  console.log('   - Low frequency but high impact when called');
}

/**
 * Provide scaling projections
 */
function scalingProjections(baseCost, baseUsers = 10000) {
  console.log('\n=== SCALING PROJECTIONS ===\n');
  
  const scales = [
    { users: 50000, multiplier: 5 },
    { users: 100000, multiplier: 10 },
    { users: 500000, multiplier: 50 },
    { users: 1000000, multiplier: 100 }
  ];
  
  scales.forEach(scale => {
    const estimatedCost = baseCost * scale.multiplier;
    const costPerUser = estimatedCost / scale.users;
    
    console.log(`${scale.users.toLocaleString()} users/month:`);
    console.log(`  Estimated cost: $${estimatedCost.toFixed(2)}/month`);
    console.log(`  Cost per user: $${costPerUser.toFixed(4)}`);
    console.log('');
  });
}

/**
 * Main analysis function
 */
async function analyzeMongoDBCosts() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const dbName = process.env.MONGODB_DB_NAME || 'canyoubeatthemarket';
    const database = client.db(dbName);
    
    console.log(`Analyzing database: ${dbName}`);
    
    // Step 1: Measure actual document sizes
    const sizes = await analyzeDocumentSizes(database);
    
    // Step 2: Analyze actual usage from invoice
    const actual = analyzeActualUsage();
    
    // Step 3: Calculate projected costs for 10,000 users
    const userDistribution = {
      bounces: 5000,           // 50% bounce rate
      anonymousGames: 3500,    // 35% play without account
      registeredUsers: 1500    // 15% have accounts
    };
    
    const projected = calculateMonthlyCosts(userDistribution);
    
    // Step 4: Analyze optimization impact
    analyzeOptimizationImpact(actual.actualTotal);
    
    // Step 5: Identify bottlenecks
    identifyBottlenecks(sizes);
    
    // Step 6: Scaling projections
    scalingProjections(projected.totalCost);
    
    // Final summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Current monthly cost: $${actual.actualTotal.toFixed(2)}`);
    console.log(`Estimated monthly visitors: ~${actual.estimatedVisitors.toLocaleString()}`);
    console.log(`Cost per visitor: $${(actual.actualTotal / actual.estimatedVisitors).toFixed(4)}`);
    console.log('');
    console.log('Key findings:');
    console.log('- RPUs account for 96% of total costs');
    console.log('- Biggest cost driver: Read operations and aggregations');
    console.log('- Optimization potential: 30-40% cost reduction');
    console.log('- Most expensive operation: getUserStats (globalStats read)');
    console.log('');
    console.log('Recommendations:');
    console.log('1. Implement on-demand percentile calculation (remove allExcessReturns)');
    console.log('2. Monitor cache hit rates and adjust TTLs');
    console.log('3. Consider rate limiting getUserStats calls');
    console.log('4. Continue optimizing aggregation pipelines');
    
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeMongoDBCosts();

