// scripts/verifyWinStreakProbability.cjs
// Compares theoretical vs experimental probability of winning N games in a row

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;

if (!uri) {
  console.error('Missing MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET environment variable');
  process.exit(1);
}

const client = new MongoClient(uri);

async function analyzeWinStreaks() {
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const database = client.db('canyoubeatthemarket');
    const visitorsCollection = database.collection('visitors');

    // Get all valid games
    const allValidGames = await visitorsCollection.find({ valid: true }).toArray();
    console.log(`Total valid games: ${allValidGames.length}\n`);

    // Calculate single-game win rate
    const wins = allValidGames.filter(g => {
      const excess = g.portfolioCAGR - g.buyHoldCAGR;
      return excess > 0;
    });
    const singleGameWinRate = wins.length / allValidGames.length;
    
    console.log('=== SINGLE GAME PROBABILITY ===');
    console.log(`Games that beat buy-and-hold: ${wins.length}`);
    console.log(`Games that lost/tied: ${allValidGames.length - wins.length}`);
    console.log(`Single-game win rate: ${(singleGameWinRate * 100).toFixed(2)}%\n`);

    // Theoretical probability of N consecutive wins (assuming independence)
    console.log('=== THEORETICAL PROBABILITIES (assuming independence) ===');
    for (let n of [2, 3, 5, 10]) {
      const prob = Math.pow(singleGameWinRate, n);
      console.log(`${n} wins in a row: ${(prob * 100).toFixed(4)}% (1 in ${Math.round(1/prob).toLocaleString()})`);
    }
    console.log('');

    // Now calculate EXPERIMENTAL probabilities from actual user data
    // Group games by userId (or visitorFingerprint for anonymous users)
    const userGames = {};
    
    for (let game of allValidGames) {
      const identifier = game.userId || game.visitorFingerprint;
      if (!identifier) continue;
      
      if (!userGames[identifier]) {
        userGames[identifier] = [];
      }
      userGames[identifier].push({
        date: new Date(game.visitDate),
        won: (game.portfolioCAGR - game.buyHoldCAGR) > 0
      });
    }

    // Sort each user's games by date
    for (let identifier in userGames) {
      userGames[identifier].sort((a, b) => a.date - b.date);
    }

    console.log(`Total unique users/sessions: ${Object.keys(userGames).length}\n`);

    // Find all win streaks of length N
    console.log('=== EXPERIMENTAL WIN STREAKS ===');
    
    for (let n of [2, 3, 5, 10]) {
      let streaksOfLengthN = 0;
      let totalOpportunities = 0; // Total consecutive N-game sequences
      
      for (let identifier in userGames) {
        const games = userGames[identifier];
        
        // Check each consecutive sequence of N games
        for (let i = 0; i <= games.length - n; i++) {
          totalOpportunities++;
          const sequence = games.slice(i, i + n);
          
          // Check if all N games were wins
          if (sequence.every(g => g.won)) {
            streaksOfLengthN++;
          }
        }
      }
      
      const experimentalProb = totalOpportunities > 0 
        ? streaksOfLengthN / totalOpportunities 
        : 0;
      
      const theoreticalProb = Math.pow(singleGameWinRate, n);
      const difference = ((experimentalProb - theoreticalProb) * 100).toFixed(4);
      
      console.log(`${n} consecutive wins:`);
      console.log(`  Theoretical: ${(theoreticalProb * 100).toFixed(4)}%`);
      console.log(`  Experimental: ${(experimentalProb * 100).toFixed(4)}% (${streaksOfLengthN} out of ${totalOpportunities} sequences)`);
      console.log(`  Difference: ${difference > 0 ? '+' : ''}${difference}%`);
      console.log('');
    }

    // Find longest win streak in the database
    let longestStreak = 0;
    let longestStreakUser = null;
    
    for (let identifier in userGames) {
      const games = userGames[identifier];
      let currentStreak = 0;
      let maxStreak = 0;
      
      for (let game of games) {
        if (game.won) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      if (maxStreak > longestStreak) {
        longestStreak = maxStreak;
        longestStreakUser = identifier;
      }
    }
    
    console.log('=== LONGEST WIN STREAK ===');
    console.log(`Longest streak in database: ${longestStreak} consecutive wins`);
    console.log(`User/Session: ${longestStreakUser?.substring(0, 16)}...`);
    
  } catch (error) {
    console.error('Error analyzing win streaks:', error);
  } finally {
    await client.close();
  }
}

analyzeWinStreaks();
