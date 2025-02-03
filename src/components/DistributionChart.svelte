<script>
import {
    onMount,
    onDestroy
} from 'svelte';
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

// Expect the visitorData and userGame props.
export let visitorData = [];
export let userGame = null;
// Allow binding for a note (distinct from the excess returns note).
// We'll use a local variable for the distribution note.
let distributionNote = '';

let chart;
let canvasElement;

// --- Helper functions ---
// Helper: Compute the interquartile range.
function interquartileRange(data) {
    const sorted = data.slice().sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length / 4))];
    const q3 = sorted[Math.floor((3 * sorted.length) / 4)];
    return q3 - q1;
}

// Compute a histogram from an array of numbers.
function computeHistogram(data) {
    if (!data.length) return {
        binCenters: [],
        counts: [],
        binWidth: 0,
        min: 0,
        max: 0
    };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const n = data.length;

    // Try Freedman–Diaconis rule:
    const IQR = interquartileRange(data);
    let binWidth = IQR / Math.cbrt(n); // Freedman–Diaconis: h = 2 * IQR / n^(1/3)
    if (binWidth === 0 || !isFinite(binWidth)) {
        // Fallback to Sturges' formula:
        const binCountSturges = Math.ceil(Math.log2(n) + 1);
        binWidth = (max - min) / binCountSturges;
    }

    const binCount = Math.max(1, Math.ceil((max - min) / binWidth));
    const counts = Array(binCount).fill(0);
    const binCenters = [];

    data.forEach(val => {
        let bin = Math.floor((val - min) / binWidth);
        if (bin === binCount) {
            bin = binCount - 1;
        }
        counts[bin]++;
    });

    for (let i = 0; i < binCount; i++) {
        binCenters.push(min + binWidth * (i + 0.5));
    }

    return {
        binCenters,
        counts,
        binWidth,
        min,
        max
    };
}

// Calculate mean and standard deviation.
function calcStats(data) {
    const n = data.length;
    if (n === 0) return {
        mu: 0,
        sigma: 0
    };

    const mu = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((sum, x) => sum + (x - mu) ** 2, 0) / n;
    const sigma = Math.sqrt(variance);
    return {
        mu,
        sigma
    };
}

// Calculate the normal probability density function.
function normPDF(x, mu, sigma) {
    if (sigma === 0) return 0;
    return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

// Create a set of Gaussian-fit points over the given range.
function computeGaussianLine({
    mu,
    sigma
}, binMin, binMax, nPoints, countScale) {
    const points = [];
    const step = (binMax - binMin) / (nPoints - 1);
    for (let i = 0; i < nPoints; i++) {
        const xVal = binMin + i * step;
        const yVal = normPDF(xVal, mu, sigma) * countScale;
        points.push({
            x: xVal,
            y: yVal
        });
    }
    return points;
}

function createChart() {
    // Extract valid numbers from the visitorData.
    const userData = visitorData
        .map(doc => Number(doc.portfolioCAGR))
        .filter(val => !isNaN(val));
    const bhData = visitorData
        .map(doc => Number(doc.buyHoldCAGR))
        .filter(val => !isNaN(val));

    // Compute histograms (100 bins each).
    const userHist = computeHistogram(userData);
    const bhHist = computeHistogram(bhData);

    // Compute stats (mean and standard deviation).
    const userStats = calcStats(userData);
    const bhStats = calcStats(bhData);

    // Scale factors for overlaying the Gaussian curves.
    const userScale = userData.length * userHist.binWidth;
    const bhScale = bhData.length * bhHist.binWidth;

    // Compute Gaussian line data for each dataset.
    const userGaussian = computeGaussianLine(userStats, userHist.min, userHist.max, 1, userScale);
    const bhGaussian = computeGaussianLine(bhStats, bhHist.min, bhHist.max, 1, bhScale);

    // Prepare bar data for histograms.
    const userBarData = userHist.binCenters.map((center, i) => ({
        x: center,
        y: userHist.counts[i]
    }));
    const bhBarData = bhHist.binCenters.map((center, i) => ({
        x: center,
        y: bhHist.counts[i]
    }));

    // Set x-axis domain to cover both datasets.
    const xMin = Math.min(userHist.min, bhHist.min);
    const xMax = Math.max(userHist.max, bhHist.max);

    // Define the datasets.
    const datasets = [{
            label: 'User',
            data: userBarData,
            backgroundColor: 'rgb(67, 91, 159, 0.5)',
            borderWidth: 0,
            barPercentage: 100,
            categoryPercentage: 1,
            order: 1
        },
        {
            label: `User Fit (μ=${userStats.mu.toFixed(2)})`,
            data: userGaussian,
            type: 'line',
            borderColor: 'rgb(244, 67, 54, 50)',
            borderDash: [5, 5],
            borderWidth: 3,
            fill: false,
            pointRadius: 1,
            order: 2,
            pointStyle: 'line'
        },
        {
            label: 'B&H',
            data: bhBarData,
            backgroundColor: 'rgb(0, 139, 2, 50)',
            borderWidth: 0,
            barPercentage: 100,
            categoryPercentage: 1,
            order: 3
        },
        {
            label: `Fit (μ=${bhStats.mu.toFixed(2)})`,
            data: bhGaussian,
            type: 'line',
            borderColor: '#B8BECE',
            borderDash: [5, 5],
            borderWidth: 3,
            fill: false,
            pointRadius: 1,
            order: 4
        }
    ];

    // If a valid userGame is provided, add a vertical line at the user's return.
    if (userGame && userGame.portfolioCAGR !== undefined) {
        const userReturn = Number(userGame.portfolioCAGR);
        // Compute the y-value on the user Gaussian curve at the user's return.
        const userFitY = normPDF(userReturn, userStats.mu, userStats.sigma) * userData.length * userHist.binWidth;
        // Choose green if the user's return is above average, else red.
        const lineColor = (userReturn > userStats.mu) ? '#008b02' : '#f44336';
        datasets.push({
            label: 'Your Previous Run',
            data: [{
                x: userReturn,
                y: 0
            }, {
                x: userReturn,
                y: userFitY
            }],
            type: 'line',
            borderColor: lineColor,
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            order: 5
        });
    }

    // Create the note explaining the significance of the averages.
    distributionNote = `Note: The average user return is ${userStats.mu.toFixed(2)}% compared to the average buy-and-hold return of ${bhStats.mu.toFixed(2)}%. A higher user return indicates that active trading outperformed the passive strategy, while a lower user return suggests underperformance.`;

    // Destroy any existing chart instance.
    if (chart) {
        chart.destroy();
    }

    // Create the Chart.js chart.
    chart = new Chart(canvasElement, {
        type: 'bar',
        data: {
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    min: xMin,
                    max: xMax,
                    offset: false, // ensures the plot area spans exactly from xMin to xMax
                    title: {
                        display: true,
                        text: 'Compound Annual Growth Rate (CAGR) [%]',
                        font: {
                            size: 12,
                            family: "'Press Start 2P'"
                        }
                    },
                    ticks: {
                        font: {
                            size: 8.5,
                            family: "'Press Start 2P'"
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency',
                        font: {
                            size: 12,
                            family: "'Press Start 2P'"
                        }
                    },
                    ticks: {
                        font: {
                            size: 8.5,
                            family: "'Press Start 2P'"
                        }
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Distribution of Annual Returns',
                    font: {
                        size: 10,
                        family: "'Press Start 2P'"
                    },
                    color: "#353535"
                },
                legend: {
                    labels: {
                        font: {
                            size: 8,
                            family: "'Press Start 2P'"
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'nearest',
                    bodyFont: {
                        family: "'Press Start 2P'",
                        size: 10
                    },
                    titleFont: {
                        family: "'Press Start 2P'",
                        size: 12
                    }
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
/* Match container styles with your excess returns chart container */
.chart-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 97%;
    max-width: 1000px;
    padding-bottom: 10px;
    height: 350px;
}

.note {
    font-family: 'Press Start 2P';
    font-size: 10px;
    margin-top: 10px;
}
</style>

<div class="chart-container">
    <canvas bind:this={canvasElement}></canvas>
</div>
<div class="note">
    {distributionNote}
</div>
