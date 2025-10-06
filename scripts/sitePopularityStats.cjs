// Comprehensive site popularity statistics
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://collincollins:UD1vcKj0cjFWEUK8@canyoubeatthemarketclus.jfny6py.mongodb.net/?retryWrites=true&w=majority&appName=canyoubeatthemarketcluster";

async function getSiteStats() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('📊 Can You Beat The Market - Site Popularity Report\n');
    console.log('='.repeat(70));
    
    const database = client.db('canyoubeatthemarket');
    const visitors = database.collection('visitors');
    const users = database.collection('users');
    
    // ============================================================
    // 1. UNIQUE VISITORS (by hashed IP fingerprint)
    // ============================================================
    const uniqueVisitors = await visitors.distinct('visitorFingerprint');
    console.log('\n📍 UNIQUE VISITORS');
    console.log(`Total unique visitors (by IP): ${uniqueVisitors.length.toLocaleString()}`);
    
    // ============================================================
    // 2. TOTAL PAGE VISITS / SESSIONS
    // ============================================================
    const totalSessions = await visitors.countDocuments({});
    const sessionsWithGames = await visitors.countDocuments({ hasStarted: true });
    console.log('\n🌐 PAGE VISITS / SESSIONS');
    console.log(`Total sessions: ${totalSessions.toLocaleString()}`);
    console.log(`Sessions with games: ${sessionsWithGames.toLocaleString()}`);
    console.log(`Bounce rate: ${((1 - sessionsWithGames/totalSessions) * 100).toFixed(1)}%`);
    
    // ============================================================
    // 3. GAMES PLAYED
    // ============================================================
    const totalGamesStarted = await visitors.countDocuments({ hasStarted: true });
    const validGames = await visitors.countDocuments({ valid: true });
    const wins = await visitors.countDocuments({ valid: true, win: true });
    
    console.log('\n🎮 GAMES PLAYED');
    console.log(`Total games started: ${totalGamesStarted.toLocaleString()}`);
    console.log(`Valid games (≥10s): ${validGames.toLocaleString()}`);
    console.log(`Completion rate: ${((validGames/totalGamesStarted) * 100).toFixed(1)}%`);
    console.log(`Wins: ${wins.toLocaleString()}`);
    console.log(`Win rate: ${((wins/validGames) * 100).toFixed(1)}%`);
    
    // ============================================================
    // 4. TIME SPENT PLAYING
    // ============================================================
    const timeStats = await visitors.aggregate([
      { $match: { valid: true, durationOfGame: { $exists: true } } },
      {
        $group: {
          _id: null,
          totalRealSeconds: { $sum: '$durationOfGame' },
          avgGameSeconds: { $avg: '$durationOfGame' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    if (timeStats.length > 0) {
      const totalRealMinutes = Math.round(timeStats[0].totalRealSeconds / 60);
      const totalRealHours = (totalRealMinutes / 60).toFixed(1);
      const totalRealDays = (totalRealHours / 24).toFixed(1);
      const avgGameSeconds = timeStats[0].avgGameSeconds.toFixed(1);
      
      // Market time: each game = 3 years
      const totalMarketYears = (validGames * 3).toLocaleString();
      const totalMarketDecades = ((validGames * 3) / 10).toFixed(1);
      const totalMarketCenturies = ((validGames * 3) / 100).toFixed(1);
      
      console.log('\n⏱️  REAL TIME SPENT');
      console.log(`Total playtime: ${totalRealHours.toLocaleString()} hours (${totalRealDays} days)`);
      console.log(`Average game duration: ${avgGameSeconds}s`);
      
      console.log('\n📈 MARKET TIME EXPERIENCED');
      console.log(`Total market years simulated: ${totalMarketYears} years`);
      console.log(`  = ${totalMarketDecades} decades`);
      console.log(`  = ${totalMarketCenturies} centuries`);
    }
    
    // ============================================================
    // 5. CHART GAMES (games shown on excess return chart)
    // ============================================================
    console.log('\n📊 EXCESS RETURN CHART GAMES');
    console.log('(Valid games with 3-25 trades)');
    
    const realModeChartGames = await visitors.countDocuments({
      durationOfGame: { $gte: 10 },
      buys: { $exists: true },
      sells: { $exists: true },
      portfolioCAGR: { $exists: true },
      buyHoldCAGR: { $exists: true },
      realMode: true,
      startRealMarketDate: { $exists: true, $nin: [null, 0] },
      endRealMarketDate: { $exists: true, $nin: [null, 0] }
    });
    
    const realModeChartGamesFiltered = await visitors.aggregate([
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
          totalTrades: { $add: [{ $ifNull: ["$buys", 0] }, { $ifNull: ["$sells", 0] }] }
        }
      },
      {
        $match: { totalTrades: { $gt: 2, $lte: 25 } }
      },
      {
        $count: "total"
      }
    ]).toArray();
    
    const realChartCount = realModeChartGamesFiltered.length > 0 ? realModeChartGamesFiltered[0].total : 0;
    
    console.log(`Real mode chart games: ${realChartCount.toLocaleString()} games`);
    console.log(`  (${((realChartCount/validGames) * 100).toFixed(1)}% of valid games shown)`);
    
    // ============================================================
    // 6. USER ACCOUNTS
    // ============================================================
    const totalUsers = await users.countDocuments({});
    const usersWithGames = await users.aggregate([
      {
        $lookup: {
          from: 'visitors',
          localField: 'userId',
          foreignField: 'userId',
          as: 'games'
        }
      },
      {
        $match: {
          'games.0': { $exists: true }
        }
      },
      {
        $count: 'total'
      }
    ]).toArray();
    
    const activeUsers = usersWithGames.length > 0 ? usersWithGames[0].total : 0;
    
    console.log('\n👥 USER ACCOUNTS');
    console.log(`Total registered users: ${totalUsers.toLocaleString()}`);
    console.log(`Users with games: ${activeUsers.toLocaleString()}`);
    console.log(`Registration rate: ${((totalUsers/uniqueVisitors) * 100).toFixed(1)}%`);
    
    // ============================================================
    // 7. MODE PREFERENCE
    // ============================================================
    const realModeGames = await visitors.countDocuments({ valid: true, realMode: true });
    const simModeGames = validGames - realModeGames;
    
    console.log('\n🎲 GAME MODE PREFERENCE');
    console.log(`Real mode: ${realModeGames.toLocaleString()} (${((realModeGames/validGames) * 100).toFixed(1)}%)`);
    console.log(`Simulated mode: ${simModeGames.toLocaleString()} (${((simModeGames/validGames) * 100).toFixed(1)}%)`);
    
    // ============================================================
    // 8. MONTHLY GROWTH
    // ============================================================
    console.log('\n📅 MONTHLY GROWTH (2025)');
    const monthlyData = await visitors.aggregate([
      {
        $match: {
          visitDate: {
            $gte: new Date('2025-01-01'),
            $lt: new Date('2026-01-01')
          },
          hasStarted: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$visitDate' },
            month: { $month: '$visitDate' }
          },
          games: { $sum: 1 },
          validGames: {
            $sum: { $cond: [{ $eq: ['$valid', true] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthlyData.forEach(m => {
      const monthName = months[m._id.month - 1];
      console.log(`${monthName}: ${m.games.toLocaleString()} games (${m.validGames.toLocaleString()} valid)`);
    });
    
    // ============================================================
    // 9. DATE RANGE
    // ============================================================
    const firstGame = await visitors.find({ hasStarted: true }).sort({ visitDate: 1 }).limit(1).toArray();
    const lastGame = await visitors.find({ hasStarted: true }).sort({ visitDate: -1 }).limit(1).toArray();
    
    if (firstGame.length > 0 && lastGame.length > 0) {
      const daysActive = Math.floor((lastGame[0].visitDate - firstGame[0].visitDate) / (1000 * 60 * 60 * 24));
      console.log('\n📆 ACTIVITY PERIOD');
      console.log(`First game: ${firstGame[0].visitDate.toLocaleDateString()}`);
      console.log(`Last game: ${lastGame[0].visitDate.toLocaleDateString()}`);
      console.log(`Days active: ${daysActive.toLocaleString()} days`);
      console.log(`Avg games/day: ${(totalGamesStarted / daysActive).toFixed(1)}`);
    }
    
    // ============================================================
    // 10. ENGAGEMENT METRICS
    // ============================================================
    console.log('\n💡 ENGAGEMENT METRICS');
    const avgGamesPerVisitor = (totalGamesStarted / uniqueVisitors.length).toFixed(2);
    const avgSessionsPerVisitor = (totalSessions / uniqueVisitors.length).toFixed(2);
    console.log(`Avg games per visitor: ${avgGamesPerVisitor}`);
    console.log(`Avg sessions per visitor: ${avgSessionsPerVisitor}`);
    
    console.log('\n' + '='.repeat(70));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

getSiteStats();

