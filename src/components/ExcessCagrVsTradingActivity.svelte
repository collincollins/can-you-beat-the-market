<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    ScatterController,
    LineController,
    PointElement,
    LineElement,
    LinearScale,
    Title,
    Tooltip,
    Legend,
    CategoryScale,
  } from 'chart.js';

  // Register Chart.js components
  Chart.register(
    ScatterController,
    LineController,
    PointElement,
    LineElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend
  );

  // Expect visitorData as a prop. Each visitor document should include:
  //   buys, sells, portfolioCAGR, buyHoldCAGR.
  export let visitorData = [];

  let chart;
  let canvasElement;

  // Helper: compute linear regression parameters from arrays of x and y values.
  function linearRegression(x, y) {
    const n = x.length;
    if (n === 0) return { slope: 0, intercept: 0 };

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
    return { slope, intercept };
  }

  function createChart() {
    // Process visitorData to compute totalTrades and excessCAGR.
    const cleanedData = visitorData
      .map(doc => {
        const totalTrades = (doc.buys || 0) + (doc.sells || 0);
        const portfolioCAGR = Number(doc.portfolioCAGR) || 0;
        const buyHoldCAGR = Number(doc.buyHoldCAGR) || 0;
        const excessCAGR = portfolioCAGR - buyHoldCAGR;
        return { x: totalTrades, y: excessCAGR };
      })
      .filter(d => d.x > 2 && d.x <= 30); // only include games with totalTrades > 2 and <= 30

    if (cleanedData.length === 0) {
      console.warn('No valid data available for the chart.');
      return;
    }

    // Compute the mean excess CAGR per totalTrades value.
    const groups = {};
    cleanedData.forEach(d => {
      if (!groups[d.x]) {
        groups[d.x] = [];
      }
      groups[d.x].push(d.y);
    });
    const meanData = Object.entries(groups).map(([trade, outcomes]) => {
      const sum = outcomes.reduce((a, b) => a + b, 0);
      const mean = sum / outcomes.length;
      return { x: Number(trade), y: mean };
    });

    // Prepare arrays of x and y values for regression.
    const xValues = cleanedData.map(d => d.x);
    const yValues = cleanedData.map(d => d.y);
    const { slope, intercept } = linearRegression(xValues, yValues);

    // Generate regression line data over the span of totalTrades.
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const regressionPoints = [];
    const numLinePoints = 100;
    const step = (xMax - xMin) / (numLinePoints - 1);
    for (let i = 0; i < numLinePoints; i++) {
      const xVal = xMin + i * step;
      regressionPoints.push({ x: xVal, y: slope * xVal + intercept });
    }

    // Define the datasets with explicit drawing order.
    const datasets = [
      // User outcomes: scatter points with 50% opacity.
      {
        label: 'User Outcomes',
        data: cleanedData,
        backgroundColor: 'rgba(0, 0, 255, 0.5)', // blue with 0.5 opacity
        pointRadius: 4,
        showLine: false,
        type: 'scatter',
        order: 1
      },
      // Regression line: slightly thicker line and drawn beneath the mean points.
      {
        label: `Fit: ${slope.toFixed(2)} %/trade + ${intercept.toFixed(2)} %`,
        data: regressionPoints,
        borderColor: 'red',
        borderWidth: 2, // increased line width
        fill: false,
        tension: 0,
        pointRadius: 0,
        type: 'line',
        borderDash: [4, 4],
        order: 2,
        // Use a line icon in the legend
        pointStyle: 'line'
      },
      // Mean outcomes: red points with a black border drawn on top.
      {
        label: 'Mean Excess CAGR',
        data: meanData,
        backgroundColor: 'red',
        borderColor: 'black',
        borderWidth: 0.5,
        pointRadius: 6,
        showLine: false,
        type: 'scatter',
        order: 3
      }
    ];

    // Create the Chart.js chart.
    chart = new Chart(canvasElement, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Excess CAGR vs. Trading Activity',
            font: { size: 10, family: "'Press Start 2P'" }
          },
          legend: {
            labels: {
              usePointStyle: true, // makes the legend icon match the dataset's marker style
              font: { size: 10, family: "'Press Start 2P'" }
            }
          },
          tooltip: {
            callbacks: {
              // (additional tooltip customization can be added here if desired)
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Total Trades (Buys + Sells)',
              font: { 
                size: 10,
                family: "Press Start 2P"  
              }
            },
            ticks: {
              stepSize: 2,
              font: { 
                size: 8,
                family: "Press Start 2P"
              }
            },
            min: xMin - 1,
            max: xMax + 1
          },
          y: {
            title: {
              display: true,
              text: 'Excess CAGR (%)',
              font: { 
                 size: 10,
                 family: "Press Start 2P"
              }
            },
            ticks: {
              font: { 
                size: 8,
                family: "Press Start 2P"
              }
            },
            min: -28,
            max: 25
          }
        }
      }
    });
  }

  onMount(() => {
    createChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });
</script>

<style>
  /* Updated container style to match the main chart container */
  .chart-container {
    position: relative;
    width: 93%;
    max-width: 700px;
    min-height: 293px;
  }
</style>

<div class="chart-container card">
  <canvas bind:this={canvasElement}></canvas>
</div>