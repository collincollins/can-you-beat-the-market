#!/usr/bin/env node
/**
 * Script to help identify which Netlify function is causing high invocation counts
 * 
 * Usage: node scripts/checkFunctionUsage.cjs [function-name]
 * 
 * Without arguments, it will check logs for all functions and provide recommendations.
 */

const { execSync } = require('child_process');

const functions = [
  'getVisitorCount',
  'getVisitorDocuments', 
  'createVisitorDocument',
  'updateVisitorDocument',
  'validateUser',
  'getHighScore',
  'setHighScore',
  'getLeaderboard',
  'getUserStats',
  'getAllUsers'
];

function checkFunctionLogs(functionName) {
  try {
    console.log(`\n📊 Checking ${functionName}...`);
    const output = execSync(`netlify logs:function ${functionName} 2>&1`, { 
      encoding: 'utf-8',
      timeout: 5000,
      stdio: 'pipe'
    });
    
    if (output && output.trim()) {
      const lines = output.split('\n').filter(l => l.trim());
      const recentLogs = lines.slice(-10);
      console.log(`   Recent activity: ${recentLogs.length} log entries`);
      if (recentLogs.length > 0) {
        console.log(`   Last log: ${recentLogs[recentLogs.length - 1].substring(0, 100)}...`);
      }
      return { hasActivity: true, logCount: lines.length };
    }
    return { hasActivity: false, logCount: 0 };
  } catch (error) {
    // Timeout or no logs is expected
    return { hasActivity: false, logCount: 0, error: error.message };
  }
}

function analyzeFunction(functionName) {
  const analysis = {
    name: functionName,
    risk: 'low',
    recommendations: []
  };

  switch(functionName) {
    case 'getVisitorCount':
      analysis.risk = 'HIGH';
      analysis.recommendations = [
        'Called on every page load (RetroCounterWrapper.jsx)',
        'Has client-side caching but no server-side caching headers',
        'Recommendation: Add Cache-Control headers (24+ hours)',
        'Recommendation: Consider moving to Edge Function or static generation'
      ];
      break;
    
    case 'getVisitorDocuments':
      analysis.risk = 'MEDIUM';
      analysis.recommendations = [
        'Called on every simulation start',
        'Has 6-hour server-side cache',
        'Recommendation: Only call when chart is actually viewed',
        'Recommendation: Consider lazy loading instead of pre-fetching'
      ];
      break;
    
    case 'createVisitorDocument':
      analysis.risk = 'MEDIUM';
      analysis.recommendations = [
        'Called on page load AND on simulation restart',
        'Recommendation: Only create once per session',
        'Recommendation: Reuse existing document ID if available'
      ];
      break;
    
    case 'updateVisitorDocument':
      analysis.risk = 'LOW';
      analysis.recommendations = [
        'Called once per simulation end',
        'This is expected behavior'
      ];
      break;
    
    case 'validateUser':
      analysis.risk = 'LOW';
      analysis.recommendations = [
        'Called on page load if user is logged in',
        'Consider caching validation result client-side'
      ];
      break;
    
    default:
      analysis.risk = 'LOW';
      analysis.recommendations = ['Called infrequently'];
  }

  return analysis;
}

function main() {
  const targetFunction = process.argv[2];
  
  console.log('🔍 Netlify Function Usage Analysis');
  console.log('===================================\n');
  
  if (targetFunction) {
    // Check specific function
    const analysis = analyzeFunction(targetFunction);
    console.log(`\nFunction: ${analysis.name}`);
    console.log(`Risk Level: ${analysis.risk}`);
    console.log('\nRecommendations:');
    analysis.recommendations.forEach(rec => console.log(`  • ${rec}`));
    
    console.log('\n📋 Checking recent logs...');
    checkFunctionLogs(targetFunction);
  } else {
    // Analyze all functions
    console.log('Analyzing all functions for potential issues...\n');
    
    const results = functions.map(func => {
      const analysis = analyzeFunction(func);
      const logs = checkFunctionLogs(func);
      return { ...analysis, logs };
    });

    console.log('\n\n📊 SUMMARY');
    console.log('==========\n');
    
    const highRisk = results.filter(r => r.risk === 'HIGH');
    const mediumRisk = results.filter(r => r.risk === 'MEDIUM');
    
    if (highRisk.length > 0) {
      console.log('🔴 HIGH RISK FUNCTIONS:');
      highRisk.forEach(r => {
        console.log(`\n  ${r.name}:`);
        r.recommendations.forEach(rec => console.log(`    • ${rec}`));
      });
    }
    
    if (mediumRisk.length > 0) {
      console.log('\n🟡 MEDIUM RISK FUNCTIONS:');
      mediumRisk.forEach(r => {
        console.log(`\n  ${r.name}:`);
        r.recommendations.forEach(rec => console.log(`    • ${rec}`));
      });
    }
    
    console.log('\n\n💡 NEXT STEPS:');
    console.log('  1. Check Netlify Dashboard → Functions → Analytics');
    console.log('  2. Review function logs: netlify logs:function <name>');
    console.log('  3. Implement caching improvements for high-risk functions');
    console.log('  4. Consider upgrading to Functions Pro if usage is legitimate\n');
  }
}

main();

