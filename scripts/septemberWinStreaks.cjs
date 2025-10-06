// Analyze actual win streaks achieved in September 2025
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://collincollins:UD1vcKj0cjFWEUK8@canyoubeatthemarketclus.jfny6py.mongodb.net/?retryWrites=true&w=majority&appName=canyoubeatthemarketcluster";

// Function to find the longest win streak in a sequence of games
function findLongestStreak(games) {
  let maxStreak = 0;
  let currentStreak = 0;
  
  for (const game of games) {
    if (game.win) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return maxStreak;
}

// Function to check if a visitor achieved a specific streak
function achievedStreak(games, targetStreak) {
  let currentStreak = 0;
  
  for (const game of games) {
    if (game.win) {
      currentStreak++;
      if (currentStreak >= targetStreak) {
        return true;
      }
    } else {
      currentStreak = 0;
    }
  }
  
  return false;
}

async function analyzeSeptemberWinStreaks() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    
    const database = client.db('canyoubeatthemarket');
    const visitors = database.collection('visitors');
    
    // September 2025 date range
    const startDate = new Date('2025-09-01T00:00:00Z');
    const endDate = new Date('2025-10-01T00:00:00Z');
    
    console.log('🏆 September 2025 - Win Streak Analysis\n');
    console.log('='.repeat(70));
    console.log('\nFetching September games...');
    
    // Fetch all valid games in September (simpler query, process locally)
    const allGames = await visitors.find({
      visitDate: { $gte: startDate, $lt: endDate },
      valid: true
    })
    .project({
      visitorFingerprint: 1,
      visitDate: 1,
      win: 1,
      portfolioCAGR: 1,
      buyHoldCAGR: 1
    })
    .sort({ visitDate: 1 })
    .toArray();
    
    console.log(`Loaded ${allGames.length.toLocaleString()} valid games`);
    console.log('Processing win streaks...\n');
    
    // Group games by visitor locally
    const visitorMap = new Map();
    
    allGames.forEach(game => {
      if (!visitorMap.has(game.visitorFingerprint)) {
        visitorMap.set(game.visitorFingerprint, {
          games: [],
          totalGames: 0,
          wins: 0
        });
      }
      
      const visitor = visitorMap.get(game.visitorFingerprint);
      visitor.games.push({
        visitDate: game.visitDate,
        win: game.win,
        portfolioCAGR: game.portfolioCAGR,
        buyHoldCAGR: game.buyHoldCAGR
      });
      visitor.totalGames++;
      if (game.win) visitor.wins++;
    });
    
    const visitorGames = Array.from(visitorMap.values());
    
    console.log('📊 OVERVIEW:');
    console.log(`Total unique visitors with valid games: ${visitorGames.length.toLocaleString()}`);
    
    const totalValidGames = visitorGames.reduce((sum, v) => sum + v.totalGames, 0);
    const totalWins = visitorGames.reduce((sum, v) => sum + v.wins, 0);
    
    console.log(`Total valid games: ${totalValidGames.toLocaleString()}`);
    console.log(`Total wins: ${totalWins.toLocaleString()}`);
    console.log(`Overall win rate: ${((totalWins / totalValidGames) * 100).toFixed(1)}%`);
    
    // Analyze win streaks
    const streakTargets = [2, 5, 10];
    const streakStats = {};
    
    streakTargets.forEach(target => {
      streakStats[target] = {
        achieved: 0,
        visitors: []
      };
    });
    
    let longestStreakOverall = 0;
    let longestStreakVisitor = null;
    
    visitorGames.forEach(visitor => {
      const longestStreak = findLongestStreak(visitor.games);
      
      if (longestStreak > longestStreakOverall) {
        longestStreakOverall = longestStreak;
        longestStreakVisitor = visitor;
      }
      
      streakTargets.forEach(target => {
        if (achievedStreak(visitor.games, target)) {
          streakStats[target].achieved++;
          if (streakStats[target].visitors.length < 5) {
            streakStats[target].visitors.push({
              games: visitor.totalGames,
              wins: visitor.wins,
              longestStreak: longestStreak
            });
          }
        }
      });
    });
    
    console.log('\n🎯 WIN STREAK ACHIEVEMENTS:\n');
    
    streakTargets.forEach(target => {
      const percentage = ((streakStats[target].achieved / visitorGames.length) * 100).toFixed(2);
      const oneIn = Math.round(visitorGames.length / streakStats[target].achieved) || 0;
      
      console.log(`${target}× consecutive wins:`);
      console.log(`  → ${streakStats[target].achieved.toLocaleString()} visitors (${percentage}%)`);
      if (oneIn > 0) {
        console.log(`  → 1 in ${oneIn} visitors achieved this`);
      }
      console.log();
    });
    
    // Compare to theoretical probability
    const globalWinRate = (totalWins / totalValidGames);
    
    console.log('📈 THEORETICAL vs ACTUAL:\n');
    
    streakTargets.forEach(target => {
      const theoretical = (Math.pow(globalWinRate, target) * 100).toFixed(2);
      const actual = ((streakStats[target].achieved / visitorGames.length) * 100).toFixed(2);
      const ratio = (parseFloat(actual) / parseFloat(theoretical)).toFixed(2);
      
      console.log(`${target}× wins:`);
      console.log(`  Theoretical: ${theoretical}% (if independent)`);
      console.log(`  Actual: ${actual}%`);
      console.log(`  Ratio: ${ratio}x ${ratio > 1 ? '(higher than expected!)' : '(lower than expected)'}`);
      console.log();
    });
    
    // Longest streak
    console.log('🏅 LONGEST STREAK:');
    console.log(`  → ${longestStreakOverall} consecutive wins`);
    if (longestStreakVisitor) {
      console.log(`  → Visitor played ${longestStreakVisitor.totalGames} games total`);
      console.log(`  → Won ${longestStreakVisitor.wins} games overall (${((longestStreakVisitor.wins / longestStreakVisitor.totalGames) * 100).toFixed(1)}% win rate)`);
    }
    
    // Distribution of max streaks
    console.log('\n📊 STREAK DISTRIBUTION (Top 10):');
    const streakDistribution = {};
    visitorGames.forEach(visitor => {
      const streak = findLongestStreak(visitor.games);
      streakDistribution[streak] = (streakDistribution[streak] || 0) + 1;
    });
    
    const sortedStreaks = Object.entries(streakDistribution)
      .map(([streak, count]) => ({ streak: parseInt(streak), count }))
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 10);
    
    sortedStreaks.forEach(({ streak, count }) => {
      const pct = ((count / visitorGames.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.min(Math.round(pct / 2), 30));
      console.log(`${streak.toString().padStart(2)}× wins: ${count.toString().padStart(4)} visitors (${pct.padStart(5)}%) ${bar}`);
    });
    
    // Visitors with multiple games
    const activeVisitors = visitorGames.filter(v => v.totalGames >= 5);
    console.log(`\n💡 INSIGHTS:`);
    console.log(`Visitors who played 5+ games: ${activeVisitors.length.toLocaleString()} (${((activeVisitors.length / visitorGames.length) * 100).toFixed(1)}%)`);
    
    const avgGamesPerVisitor = (totalValidGames / visitorGames.length).toFixed(1);
    console.log(`Average valid games per visitor: ${avgGamesPerVisitor}`);
    
    console.log('\n' + '='.repeat(70));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeSeptemberWinStreaks();
