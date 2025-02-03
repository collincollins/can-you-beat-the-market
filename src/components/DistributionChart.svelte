<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend
  } from 'chart.js';

  // Register the required Chart.js components.
  Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend
  );

  // Expect the visitorData prop which contains documents (each having portfolioCAGR and buyHoldCAGR).
  export let visitorData = [];

  let chart;
  let canvasElement;

  // --- Helper functions ---

  // Compute a histogram from an array of numbers.
  // Returns an object with binCenters, counts, binWidth, min and max.
  function computeHistogram(data, binCount = 100) {
    if (!data.length) return { binCenters: [], counts: [], binWidth: 0, min: 0, max: 0 };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / binCount;
    const counts = Array(binCount).fill(0);
    const binCenters = [];

    // Count data points in each bin.
    data.forEach(val => {
      let bin = Math.floor((val - min) / binWidth);
      // If val == max, assign it to the last bin.
      if (bin === binCount) {
        bin = binCount - 1;
      }
      counts[bin]++;
    });

    // Compute bin centers.
    for (let i = 0; i < binCount; i++) {
      binCenters.push(min + binWidth * (i + 0.5));
    }

    return { binCenters, counts, binWidth, min, max };
  }

  // Calculate mean and standard deviation.
  function calcStats(data) {
    const n = data.length;
    if (n === 0) return { mu: 0, sigma: 0 };

    const mu = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((sum, x) => sum + (x - mu) ** 2, 0) / n;
    const sigma = Math.sqrt(variance);
    return { mu, sigma };
  }

  // Calculate the normal probability density function.
  function normPDF(x, mu, sigma) {
    return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
  }

  // Create a set of Gaussian-fit points over the range given.
  function computeGaussianLine({ mu, sigma }, binMin, binMax, nPoints, countScale) {
    const points = [];
    const step = (binMax - binMin) / (nPoints - 1);
    for (let i = 0; i < nPoints; i++) {
      const xVal = binMin + i * step;
      // Scale the pdf so that it overlays on the histogram counts:
      // Multiply by (number of data points * binWidth)
      const yVal = normPDF(xVal, mu, sigma) * countScale;
      points.push({ x: xVal, y: yVal });
    }
    return points;
  }

  // --- Main chart creation ---
  function createChart() {
    // Filter visitorData to include only valid numbers for each field.
    const userData = visitorData
      .map(doc => Number(doc.portfolioCAGR))
      .filter(val => !isNaN(val));
    const bhData = visitorData
      .map(doc => Number(doc.buyHoldCAGR))
      .filter(val => !isNaN(val));

    // Compute histograms (using 100 bins) for each dataset.
    const userHist = computeHistogram(userData, 100);
    const bhHist = computeHistogram(bhData, 100);

    // Calculate stats for each dataset.
    const userStats = calcStats(userData);
    const bhStats = calcStats(bhData);

    // For overlaying the Gaussian line we want to scale by (number of data points * binWidth).
    const userScale = userData.length * userHist.binWidth;
    const bhScale = bhData.length * bhHist.binWidth;

    // Create Gaussian line data (using 100 points spanning the histogram range).
    const userGaussian = computeGaussianLine(userStats, userHist.min, userHist.max, 100, userScale);
    const bhGaussian = computeGaussianLine(bhStats, bhHist.min, bhHist.max, 100, bhScale);

    // Prepare data for the histogram bar charts.
    // We want an array of objects with x: binCenter, y: count.
    const userBarData = userHist.binCenters.map((center, i) => ({
      x: center,
      y: userHist.counts[i]
    }));
    const bhBarData = bhHist.binCenters.map((center, i) => ({
      x: center,
      y: bhHist.counts[i]
    }));

    // Destroy an existing chart if needed.
    if (chart) {
      chart.destroy();
    }

    // Create the chart. We use a 'bar' type for the histograms (with grouping disabled)
    // and overlay the Gaussian curves as 'line' datasets.
    chart = new Chart(canvasElement, {
      type: 'bar',
      data: {
        // There is no common labels array because the x-values come from the data points.
        datasets: [
          // Histogram for User CAGR
          {
            label: 'User Return',
            data: userBarData,
            backgroundColor: '#435b9f',
            borderWidth: 0,
            // Use a small bar percentage so that the bins are narrow.
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            // Ensure these bars are drawn in the back.
            order: 1
          },
          // Gaussian fit for User CAGR
          {
            label: `User Fit (μ=${userStats.mu.toFixed(2)})`,
            data: userGaussian,
            type: 'line',
            borderColor: '#435b9f',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 2
          },
          // Histogram for Buy‑and‑Hold CAGR
          {
            label: 'B&H Return',
            data: bhBarData,
            backgroundColor: '#B8BECE',
            borderWidth: 0,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 3
          },
          // Gaussian fit for Buy‑and‑Hold CAGR
          {
            label: `B&H Fit (μ=${bhStats.mu.toFixed(2)})`,
            data: bhGaussian,
            type: 'line',
            borderColor: '#B8BECE',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Compound Annual Growth Rate (CAGR) [%]',
              font: { size: 12 }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Frequency',
              font: { size: 12 }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Distribution of Annual Returns',
            font: { size: 14 }
          },
          legend: {
            labels: {
              font: { size: 10 }
            }
          },
          tooltip: {
            mode: 'nearest'
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
  /* Ensure the container matches the excess returns chart container */
  .chart-container-excess {
    width: 93%;
    max-width: 700px;
    height: auto;
    padding-left: 10px;
    padding-right: 0px;
    padding-top: 5px;
    padding-bottom: 10px;
  }
  /* The canvas will take up all available space in the container */
  /* canvas {
    width: 100% !important;
    height: 100% !important;
  } */
</style>

<div class="chart-container-excess card">
  <canvas bind:this={canvasElement}></canvas>
</div>