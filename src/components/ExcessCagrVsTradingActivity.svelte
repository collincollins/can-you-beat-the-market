<script>
import {
    onMount,
    onDestroy
} from 'svelte';
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

// New prop for the current (user) game. This should be an object with:
//   totalTrades, portfolioCAGR, buyHoldCAGR, etc.
// Pass this in only if the user’s game is valid.
export let userGame = null;

let chart;
let canvasElement;

// Export the result note so that App.svelte can bind to it.
export let resultNote = '';

// Helper: compute linear regression parameters from arrays of x and y values.
function linearRegression(x, y) {
    const n = x.length;
    if (n === 0) return {
        slope: 0,
        intercept: 0
    };

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
    return {
        slope,
        intercept
    };
}

function createChart() {
    // Process visitorData to compute totalTrades and excessCAGR.
    const cleanedData = visitorData
        .map(doc => {
            const totalTrades = (doc.buys || 0) + (doc.sells || 0);
            const portfolioCAGR = Number(doc.portfolioCAGR) || 0;
            const buyHoldCAGR = Number(doc.buyHoldCAGR) || 0;
            const excessCAGR = portfolioCAGR - buyHoldCAGR;
            return {
                x: totalTrades,
                y: excessCAGR
            };
        })
        .filter(d => d.x > 2 && d.x <= 25); // only include games with totalTrades > 2 and <= 25

    // Calculate the number of data points.
    // If the user's game is valid, include it in the count.
    let dataCount = cleanedData.length;
    if (userGame) {
        dataCount++;
    }

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
        return {
            x: Number(trade),
            y: mean
        };
    });

    // Prepare arrays of x and y values for regression.
    const xValues = cleanedData.map(d => d.x);
    const yValues = cleanedData.map(d => d.y);
    const {
        slope,
        intercept
    } = linearRegression(xValues, yValues);

    // Generate regression line data over the span of totalTrades.
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const regressionPoints = [];
    const numLinePoints = 100;
    const step = (xMax - xMin) / (numLinePoints - 1);
    for (let i = 0; i < numLinePoints; i++) {
        const xVal = xMin + i * step;
        regressionPoints.push({
            x: xVal,
            y: slope * xVal + intercept
        });
    }
    const xTickMin = ((xMin - 1) % 2 === 0) ? (xMin - 1) : (xMin - 1) + 1;
    const xTickMax = ((xMax + 1) % 2 === 0) ? (xMax + 1) : (xMax + 1) + 1;

    const yTickMin = Math.floor((yMin - 1) / 5) * 5;
    const yTickMax = Math.ceil((yMax + 1) / 5) * 5;

    // Define the datasets with explicit drawing order.
    const datasets = [{
            label: 'Games',
            data: cleanedData,
            backgroundColor: 'rgba(184,190,206,0.5)', // blue like background
            pointRadius: 3,
            showLine: false,
            type: 'scatter',
            order: 4
        },
        // Regression line: slightly thicker line and drawn beneath the mean points.
        {
            label: 'Fit ',
            data: regressionPoints,
            borderColor: '#f44336', // red
            borderWidth: 3, // increased line width
            fill: false,
            tension: 0,
            pointRadius: 0,
            type: 'line',
            borderDash: [4, 4],
            order: 3,
            // Use a line icon in the legend
            pointStyle: 'line'
        },
        // Mean outcomes: red points with a black border drawn on top.
        {
            label: 'Avg ',
            data: meanData,
            backgroundColor: '#435b9f', // blue like button
            borderColor: 'black',
            borderWidth: 1.5,
            pointRadius: 5,
            pointHoverRadius: 6,
            showLine: false,
            type: 'scatter',
            order: 2,
        }
    ];

    // If the user's game is valid, add the "You" datapoint.
    if (userGame) {
        // Calculate excess CAGR for the user game.
        const userExcessCAGR = Number(userGame.portfolioCAGR) - Number(userGame.buyHoldCAGR);
        // Construct the datapoint using the user's total trades.
        const userPoint = {
            x: (userGame.buys || 0) + (userGame.sells || 0),
            y: userExcessCAGR,
        };

        datasets.push({
            label: 'You ',
            data: [userPoint],
            backgroundColor: '#008b02', // green
            borderColor: 'black', // darker green
            borderWidth: 1.5,
            pointRadius: 6,
            pointHoverRadius: 7,
            pointStyle: 'rectRounded',
            type: 'scatter',
            order: 1, // draw this on top
        });
    }

    // Destroy any existing chart.
    if (chart) {
        chart.destroy();
    }

    // Create the Chart.js chart.
    chart = new Chart(canvasElement, {
        type: 'scatter',
        data: {
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: ['Excess Return vs. Trading Activity',
                        '\n',
                        '(n=' + dataCount + ')'
                    ],
                    font: {
                        size: 10,
                        family: "'Press Start 2P'"
                    },
                    color: "#353535",
                },
                legend: {
                    labels: {
                        usePointStyle: true, // makes the legend icon match the dataset's marker style
                        font: {
                            size: 8,
                            family: "'Press Start 2P'"
                        }
                    }
                },
                tooltip: {
                    filter: tooltipItem => [2, 3].includes(tooltipItem.datasetIndex),
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Total Trades (Buys + Sells)',
                        font: {
                            size: 12,
                            family: "Press Start 2P"
                        }
                    },
                    ticks: {
                        stepSize: 2,
                        font: {
                            size: 8.5,
                            family: "Press Start 2P"
                        }
                    },
                    min: xTickMin,
                    max: xTickMax,
                },
                y: {
                    title: {
                        display: true,
                        text: 'Excess Return (You-B&H) [%]',
                        font: {
                            size: 12,
                            family: "Press Start 2P"
                        }
                    },
                    ticks: {
                        font: {
                            size: 8.5,
                            family: "Press Start 2P"
                        }
                    },
                    min: yTickMin,
                    max: yTickMax,
                }
            }
        }
    });
    // Set the result note based on the slope.
    if (slope < 0) {
        resultNote = `Slope ${slope.toFixed(2)}: The trend suggests that as trading frequency increases, performance tends to lag further behind a simple buy‑and‑hold approach.`;
    } else if (slope > 0) {
        resultNote = `Slope ${slope.toFixed(2)}: The trend suggests that as trading frequency increases, performance may improve relative to a buy‑and‑hold strategy.`;
    } else {
        resultNote = `Slope ${slope.toFixed(2)}: There is no clear relationship between how often you trade and your performance compared to simply holding the investment.`;
    }
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
/* .chart-container {
    position: relative;
    height: auto;
    max-height: 350px;
    width: 97%;
    max-width: 800px;
    padding-bottom: 10px;
  } */

.chart-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 97%;
    max-width: 1000px;
    padding-bottom: 10px;
    /* Adjust padding as needed */
    height: 350px;
    /* Let the container expand */
}

/* .result-note {
    font-family: 'Press Start 2P', cursive;
    font-size: 0.75em;
    text-align: center;
    margin-top: 10px;
    color: #353535;
  } */
</style>

<div class="chart-container">
    <canvas bind:this={canvasElement}></canvas>
</div>
