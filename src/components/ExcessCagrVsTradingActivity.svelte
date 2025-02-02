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

  // Register the necessary Chart.js components
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

  // Expect visitorData to be passed in as a prop.
  // Each visitor document should have: buys, sells, portfolioCAGR, buyHoldCAGR.
  export let visitorData = [];

  let chart;
  let canvasElement;

  /**
   * Compute linear regression parameters for the given data points.
   * @param {number[]} x - Array of x values.
   * @param {number[]} y - Array of y values.
   * @returns {{slope: number, intercept: number}} - The slope and intercept.
   */
  function linearRegression(x, y) {
    const n = x.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

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
    // Process the visitor data:
    // Compute totalTrades and excessCAGR for each document.
    // We also filter to include only observations where totalTrades > 2 and <= 30.
    const cleanedData = visitorData
      .map(doc => {
        const totalTrades = (doc.buys || 0) + (doc.sells || 0);
        const portfolioCAGR = Number(doc.portfolioCAGR) || 0;
        const buyHoldCAGR = Number(doc.buyHoldCAGR) || 0;
        const excessCAGR = portfolioCAGR - buyHoldCAGR;
        return { totalTrades, excessCAGR };
      })
      .filter(d => d.totalTrades > 2 && d.totalTrades <= 30);

    if (cleanedData.length === 0) {
      console.warn('No valid data available for the Excess CAGR vs. Trading Activity chart.');
      return;
    }

    // Prepare arrays of x and y values for the individual points.
    const xValues = cleanedData.map(d => d.totalTrades);
    const yValues = cleanedData.map(d => d.excessCAGR);

    // Compute regression parameters.
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

    // Define the datasets.
    const datasets = [
      {
        label: 'User Outcomes',
        data: cleanedData,
        backgroundColor: 'blue',
        pointRadius: 4,
        showLine: false,
        type: 'scatter'
      },
      {
        label: `Fit: ${slope.toFixed(2)} %/trade + ${intercept.toFixed(2)} %`,
        data: regressionPoints,
        borderColor: 'red',
        borderWidth: 1,
        fill: false,
        tension: 0,
        pointRadius: 0,
        type: 'line',
        borderDash: [4, 4],
        backgroundColor: 'red',
        // Render the regression line behind the points
        order: 0
      }
    ];

    // Create the chart.
    chart = new Chart(canvasElement, {
      type: 'scatter',
      data: {
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Excess CAGR vs. Trading Activity',
            font: {
              size: 12
            }
          },
          legend: {
            labels: {
              font: {
                size: 10
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const { x, y } = context.parsed;
                return `Trades: ${x}, Excess CAGR: ${y.toFixed(2)}%`;
              }
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
                size: 10
              }
            },
            ticks: {
              stepSize: 2,
              font: {
                size: 9
              }
            },
            min: xMin - 1,
            max: xMax + 1,
          },
          y: {
            title: {
              display: true,
              text: 'Excess CAGR (%)',
              font: {
                size: 10
              }
            },
            ticks: {
              font: {
                size: 9
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
  .chart-container {
    position: relative;
    width: 100%;
    height: 250px;
  }
</style>

<div class="chart-container">
  <canvas bind:this={canvasElement}></canvas>
</div>