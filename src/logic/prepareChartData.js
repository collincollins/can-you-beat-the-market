// ./logic/prepareChartData.js

/**
 * A simple linear regression helper that takes arrays of
 * x and y values and returns { slope, intercept }.
 */
function linearRegression(x, y) {
  const n = x.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, slopeUncertainty: 0 };
  }

  // means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += (x[i] - meanX) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate slope uncertainty (standard error)
  let residualSumSquares = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    residualSumSquares += (y[i] - predicted) ** 2;
  }
  
  const residualVariance = n > 2 ? residualSumSquares / (n - 2) : 0;
  const slopeUncertainty = denominator > 0 ? Math.sqrt(residualVariance / denominator) : 0;

  return { slope, intercept, slopeUncertainty };
}

/**
 * Pre-computes everything needed for the "Excess CAGR vs. Trading Activity" chart:
 *   1. Cleans the raw docs into {x, y} => (totalTrades, excessCAGR).
 *   2. Groups by totalTrades for computing meanData.
 *   3. Runs linear regression for slope & intercept.
 *   4. Generates regression line points.
 *   5. Calculates axis tick boundaries.
 *
 * Returns an object containing all these bits so that the chart can be rendered quickly.
 */

export function preComputeChartData(rawVisitorDocs) {
    // 1. Convert raw docs into { x: totalTrades, y: excessCAGR }
    const cleanedData = rawVisitorDocs.map(doc => {
        const totalTrades = doc.totalTrades
        const portfolioCAGR = Number(doc.portfolioCAGR) || 0;
        const buyHoldCAGR = Number(doc.buyHoldCAGR) || 0;
        const excessCAGR = portfolioCAGR - buyHoldCAGR;

        return { x: totalTrades, y: excessCAGR };
    });


    // Step 2: Group by totalTrades to compute the mean
    const groups = {};
    cleanedData.forEach(d => {
        if (!groups[d.x]) {
            groups[d.x] = [];
        }
        groups[d.x].push(d.y);
    });
    const meanData = Object.entries(groups).map(([trade, outcomes]) => {
        const sum = outcomes.reduce((a, b) => a + b, 0);
        const avg = sum / outcomes.length;
        return { x: Number(trade), y: avg };
    });

    // Step 3: Regression
    const xValues = cleanedData.map(d => d.x);
    const yValues = cleanedData.map(d => d.y);
    const { slope, intercept, slopeUncertainty } = linearRegression(xValues, yValues);

    // Step 4: Generate points for the line
    let xMin = Math.min(...xValues);
    let xMax = Math.max(...xValues);
    if (xValues.length === 0) {
        xMin = 0;
        xMax = 0;
      }
    const numLinePoints = 100;
    const step = (xMax - xMin) / (numLinePoints - 1) || 0;
    const regressionPoints = [];
    for (let i = 0; i < numLinePoints; i++) {
        const xVal = xMin + i * step;
        regressionPoints.push({
            x: xVal,
            y: slope * xVal + intercept,
        });
    }

  // 5. Calculate tick boundaries for the chart
  const yAllValues = yValues.length > 0 ? yValues : [0];
  const yMin = Math.min(...yAllValues);
  const yMax = Math.max(...yAllValues);

  // do your typical logic for rounding ticks:
  const xTickMin = xMin - 1; // or however you used to do it
  const xTickMax = xMax + 1;
  const roughYMin = Math.floor((yMin - 1) / 5) * 5;
  const roughYMax = Math.ceil((yMax + 1) / 5) * 5;

  // Return all of it
  return {
    cleanedData,
    meanData,
    slope,
    slopeUncertainty,
    intercept,
    regressionPoints,
    // for chart config:
    xMin, 
    xMax, 
    yMin, 
    yMax, 
    xTickMin,
    xTickMax,
    yTickMin: roughYMin,
    yTickMax: roughYMax
  };
}