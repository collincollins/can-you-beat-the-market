// scripts/testChartDataSize.cjs
// Compare old vs new chart data response sizes

function testChartDataSizes() {
  console.log('=== CHART DATA SIZE COMPARISON TEST ===\n');
  
  try {
    // Use actual measured data from production
    const oldSize = 433485; // bytes (measured via curl)
    const oldGames = 7082;   // games returned
    
    console.log('OLD APPROACH (Individual Games):');
    console.log(`  Games returned: ${oldGames.toLocaleString()}`);
    console.log(`  Response size: ${(oldSize / 1024).toFixed(2)} KB`);
    console.log(`  Bytes per game: ${(oldSize / oldGames).toFixed(0)}`);
    console.log('');
    console.log('  Weekly stats (based on actual usage):');
    console.log(`    Calls per week: 29,320`);
    console.log(`    Weekly bandwidth: ${(oldSize * 29320 / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`    Monthly bandwidth: ${(oldSize * 29320 * 4.33 / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`    Estimated monthly cost: $${((oldSize * 29320 * 4.33 / 1024 / 1024 / 1024) * 0.55).toFixed(2)}`);
    console.log('');
    
    // Simulate new approach
    const estimatedMeanPoints = 23; // One per trade count (3-25)
    const estimatedNewSize = 500; // bytes (aggregated means + regression)
    
    console.log('NEW APPROACH (Aggregated Means):');
    console.log(`  Mean points: ~${estimatedMeanPoints} (one per trade count)`);
    console.log(`  Estimated response size: ${(estimatedNewSize / 1024).toFixed(2)} KB`);
    console.log('');
    console.log('  Weekly stats (based on actual usage):');
    console.log(`    Calls per week: 29,320`);
    console.log(`    Weekly bandwidth: ${(estimatedNewSize * 29320 / 1024 / 1024 / 1024).toFixed(3)} GB`);
    console.log(`    Monthly bandwidth: ${(estimatedNewSize * 29320 * 4.33 / 1024 / 1024 / 1024).toFixed(3)} GB`);
    console.log(`    Estimated monthly cost: $${((estimatedNewSize * 29320 * 4.33 / 1024 / 1024 / 1024) * 0.55).toFixed(2)}`);
    console.log('');
    
    // Calculate savings
    const oldMonthlyGB = oldSize * 29320 * 4.33 / 1024 / 1024 / 1024;
    const newMonthlyGB = estimatedNewSize * 29320 * 4.33 / 1024 / 1024 / 1024;
    const gbSavings = oldMonthlyGB - newMonthlyGB;
    const costSavings = gbSavings * 0.55;
    const percentReduction = ((oldSize - estimatedNewSize) / oldSize) * 100;
    
    console.log('SAVINGS:');
    console.log(`  Payload size reduction: ${percentReduction.toFixed(1)}%`);
    console.log(`  Bandwidth savings: ${gbSavings.toFixed(2)} GB/month`);
    console.log(`  Cost savings: $${costSavings.toFixed(2)}/month`);
    console.log(`  Annual savings: $${(costSavings * 12).toFixed(2)}/year`);
    console.log('');
    console.log('VISUAL IMPACT:');
    console.log(`  Individual game points: removed (cleaner chart)`);
    console.log(`  Mean points per trade count: retained`);
    console.log(`  Regression line: retained`);
    console.log(`  User's game point: retained`);
    console.log(`  Trend visibility: IMPROVED (less noise)`);
    
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testChartDataSizes();

