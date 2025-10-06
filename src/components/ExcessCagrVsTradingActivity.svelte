<!-- ./components/ExcessCagrVsTradingActivity.svelte -->
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

// register Chart.js components
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

// import store that contains all the precomputed chart data
import {
    precomputedChartDataStore
} from '../logic/store';

// props, passed in from App.svelte:
// - userGame: the user's final game data (null if invalid).
// - resultNote: a bound string that we update to describe the slope results.
export let userGame = null;
export let resultNote = '';

let chart;
let canvasElement;
let isLoading = true;

// We'll keep a copy of the precomputed data
let precomputedData = {
    cleanedData: [],
    meanData: [],
    slope: 0,
    intercept: 0,
    regressionPoints: [],
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    xTickMin: 0,
    xTickMax: 0,
    yTickMin: 0,
    yTickMax: 0
};

// subscribe to the precomputedChartDataStore
const unsubscribe = precomputedChartDataStore.subscribe(value => {
    precomputedData = value;
    
    // Check if we have data
    if (value.cleanedData && value.cleanedData.length > 0) {
        isLoading = false;
    }

    createChart();
});

// svelte's onMount - we can create the chart immediately if data is already in the store
onMount(() => {
    createChart();
});

// Clean up when this component is destroyed
onDestroy(() => {
    unsubscribe();
    if (chart) {
        chart.destroy();
        chart = null;
    }
});

/**
 * createChart()
 * uses the precomputed data + userGame to build the Chart.js datasets
 * and then instantiate (or re-instantiate) the Chart.
 */
function createChart() {
    // If there's no canvas anymore, bail out.
    if (!canvasElement) {
        return;
    }

    // Destroy an existing chart instance if it exists
    if (chart) {
        chart.destroy();
        chart = null;
    }

    // If there's no data at all, bail out
    if (!precomputedData.cleanedData || precomputedData.cleanedData.length === 0) {
        console.warn('No valid data available for the chart.');
        return;
    }

    // Destructure everything from precomputedData for convenience
    const {
        cleanedData,
        meanData,
        slope,
        slopeUncertainty,
        intercept,
        regressionPoints,
        xTickMin,
        xTickMax,
        yTickMin,
        yTickMax
    } = precomputedData;
  
    // define the datasets with explicit drawing order.
    const datasets = [{
            label: 'Games',
            data: cleanedData,
            backgroundColor: 'rgba(184,190,206,0.5)', // blue like background
            pointRadius: 3,
            showLine: false,
            type: 'scatter',
            order: 4
        },
        // regression line: slightly thicker line and drawn beneath the mean points.
        {
            label: 'Fit ',
            data: regressionPoints,
            borderColor: '#f44336', // red
            borderWidth: 3,
            fill: false,
            tension: 0,
            pointRadius: 0,
            type: 'line',
            borderDash: [4, 4],
            order: 3,
            pointStyle: 'line'
        },
        // mean outcomes: red points with a black border drawn on top.
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

    let totalPoints = cleanedData.length;

    // if the user's game is valid, add the "You" datapoint.
    if (userGame) {
        // calculate excess CAGR for the user game.
        const userExcessCAGR = Number(userGame.portfolioCAGR) - Number(userGame.buyHoldCAGR);
        const userTrades = (userGame.buys || 0) + (userGame.sells || 0);
        // construct the datapoint using the user's total trades.
        const userPoint = {
            x: userTrades,
            y: userExcessCAGR,
        };
        datasets.push({
            label: 'You ',
            data: [userPoint],
            backgroundColor: '#008b02', // green
            borderColor: 'black',
            borderWidth: 1.5,
            pointRadius: 6,
            pointHoverRadius: 7,
            pointStyle: 'rectRounded',
            type: 'scatter',
            order: 1, // draw this on top
        });
        totalPoints += 1;
    }

    // create the Chart.js chart.
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
                        '(n=' + totalPoints + ')'
                    ],
                    font: {
                        size: 10,
                        family: "'Press Start 2P'"
                    },
                    color: '#353535',
                },
                legend: {
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 8,
                            family: "'Press Start 2P'"
                        }
                    }
                },
                tooltip: {
                    filter: tooltipItem => [2, 3].includes(tooltipItem.datasetIndex),
                    enabled: true,
                    bodyFont: {
                        family: "'Press Start 2P'",
                        size: 8
                    },
                    titleFont: {
                        family: "'Press Start 2P'",
                        size: 10
                    },
                    footerFont: {
                        family: "'Press Start 2P'",
                        size: 8
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

    // set the result note based on the slope.
    const slopeDisplay = slopeUncertainty > 0 
      ? `(${slope.toFixed(2)} ± ${slopeUncertainty.toFixed(2)}) [%/trade]`
      : `${slope.toFixed(2)} [%/trade]`;
    
    if (slope < 0) {
        resultNote = `Slope ${slopeDisplay}: The trend suggests that as trading frequency increases, performance tends to lag further behind a simple buy‑and‑hold approach.`;
    } else if (slope > 0) {
        resultNote = `Slope ${slopeDisplay}: The trend suggests that as trading frequency increases, performance may improve relative to a buy‑and‑hold strategy.`;
    } else {
        resultNote = `Slope ${slopeDisplay}: There is no clear relationship between how often you trade and your performance compared to simply holding the investment.`;
    }
}
</script>

<style>
.chart-container {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 97%;
    max-width: 1000px;
    padding-bottom: 10px;
    height: 350px;
}

.chart-skeleton {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 10px;
    border: 2px solid black;
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}
</style>

<div class="chart-container">
    {#if isLoading}
        <div class="chart-skeleton"></div>
    {:else}
        <canvas bind:this={canvasElement}></canvas>
    {/if}
</div>
