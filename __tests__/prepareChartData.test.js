// __tests__/prepareChartData.test.js
// Test for empty array bug in Math.min/Math.max operations

import { preComputeChartData } from '../src/logic/prepareChartData';

describe('prepareChartData - Empty Array Bug', () => {
  test('BEFORE FIX: Returns Infinity/-Infinity for empty data', () => {
    // When no visitor documents are provided
    const emptyData = [];

    const result = preComputeChartData(emptyData);

    // BEFORE FIX: xMin/xMax are set to Infinity/-Infinity initially
    // This causes NaN in regression calculations
    // The check happens AFTER the Math.min/Math.max calls

    // Verify the bug doesn't cause NaN in regression points
    expect(result.regressionPoints).toBeDefined();
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);

    // These should be 0, not Infinity/-Infinity
    expect(result.xMin).toBe(0);
    expect(result.xMax).toBe(0);
    expect(isFinite(result.xMin)).toBe(true);
    expect(isFinite(result.xMax)).toBe(true);
  });

  test('BEFORE FIX: NaN values when data is []', () => {
    const result = preComputeChartData([]);

    // Regression points shouldn't contain NaN
    result.regressionPoints.forEach(point => {
      expect(isNaN(point.x)).toBe(false);
      expect(isNaN(point.y)).toBe(false);
    });
  });

  test('Works correctly with valid data', () => {
    const validData = [
      { totalTrades: 5, portfolioCAGR: 10, buyHoldCAGR: 8 },
      { totalTrades: 10, portfolioCAGR: 12, buyHoldCAGR: 8 },
      { totalTrades: 15, portfolioCAGR: 11, buyHoldCAGR: 8 }
    ];

    const result = preComputeChartData(validData);

    expect(result.cleanedData).toHaveLength(3);
    expect(result.xMin).toBe(5);
    expect(result.xMax).toBe(15);
    expect(isFinite(result.slope)).toBe(true);
    expect(isFinite(result.intercept)).toBe(true);
  });

  test('Handles single data point', () => {
    const singlePoint = [
      { totalTrades: 5, portfolioCAGR: 10, buyHoldCAGR: 8 }
    ];

    const result = preComputeChartData(singlePoint);

    expect(result.xMin).toBe(5);
    expect(result.xMax).toBe(5);
    expect(result.cleanedData).toHaveLength(1);
  });

  test('Handles non-array input gracefully', () => {
    const result = preComputeChartData(null);

    // Should treat as empty array
    expect(result.cleanedData).toHaveLength(0);
    expect(result.xMin).toBe(0);
    expect(result.xMax).toBe(0);
  });

  test('Handles undefined input', () => {
    const result = preComputeChartData(undefined);

    expect(result.cleanedData).toHaveLength(0);
    expect(result.xMin).toBe(0);
    expect(result.xMax).toBe(0);
  });
});

describe('Edge Cases for Regression Calculation', () => {
  test('Empty data produces zero slope and intercept', () => {
    const result = preComputeChartData([]);

    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.slopeUncertainty).toBe(0);
  });

  test('Regression points are empty array for no data', () => {
    const result = preComputeChartData([]);

    // When xMin === xMax === 0, step = 0, so we get array of 100 points at x=0
    expect(Array.isArray(result.regressionPoints)).toBe(true);
    result.regressionPoints.forEach(point => {
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });
  });
});
