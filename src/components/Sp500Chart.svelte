<script>
import {
    onMount,
    onDestroy
} from 'svelte';
import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    LogarithmicScale,
    CategoryScale,
    TimeScale,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    LogarithmicScale,
    CategoryScale,
    TimeScale,
    Title,
    Tooltip,
    Legend,
    annotationPlugin
);

import {
    getSimulationParams
} from '../logic/simulationConfig';
// import {
//     marketData
// } from '../logic/store'; // to access simulation day info

// Accept simulation dates from App.svelte.
export let simulationStartDate = null;
export let simulationEndDate = null;

let canvas;
let chart;

let sp500Data = [];
let smoothedData = [];

// rolling average function for smoothing the data.
function applyRollingAverage(data, windowSize) {
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const subset = data.slice(start, i + 1);
        const sum = subset.reduce((acc, val) => acc + val, 0);
        smoothed.push(sum / subset.length);
    }
    return smoothed;
}

let yMinBox, yMaxBox;

onMount(async () => {
    const response = await fetch('/data/sp500_filtered.json');
    sp500Data = await response.json();

    let windowSize = 1;
    const prices = sp500Data.map(d => d.Close);
    smoothedData = applyRollingAverage(prices, windowSize);

    const datasetData = sp500Data.map((d, i) => ({
        x: new Date(d.Date),
        y: smoothedData[i]
    }));

    // sample the data to weekly values
    const weeklyData = datasetData.filter((_, i) => i % 5 === 0);
    // determine the full date range from the dataset.
    const fullFirstDate = new Date(sp500Data[0].Date);
    const fullLastDate = new Date(sp500Data[sp500Data.length - 1].Date);

    // determine the previous game's market interval.
    // if we’re in real mode and the props were provided, use them.
    // otherwise, fall back to the full dataset range.
    const effectiveStartDate = (getSimulationParams().realMode && simulationStartDate) ?
        new Date(simulationStartDate) :
        fullFirstDate;
    const effectiveEndDate = (getSimulationParams().realMode && simulationEndDate) ?
        new Date(simulationEndDate) :
        fullLastDate;

    const simulationWeeklyData = weeklyData.filter(point =>
        point.x >= effectiveStartDate && point.x <= effectiveEndDate
    );
    if (simulationWeeklyData.length > 0) {
        const yValues = simulationWeeklyData.map(point => point.y);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        yMinBox = minY * 0.70;
        yMaxBox = maxY * 1.50;
    } else {
        console.log("There is no data in the previous game's interval")
    }

    chart = new Chart(canvas, {
        type: 'line',
        data: {
            // for labels, use sequential day numbers.
            datasets: [{
                data: weeklyData,
                borderColor: 'black',
                backgroundColor: 'black',
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 1.0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        generateLabels: (chart) => {
                            return [{
                                text: 'Your Game',
                                fontColor: '#545454',
                                fillStyle: 'rgb(0, 139, 2, 0.1)',
                                strokeStyle: 'rgb(0, 139, 2, 1)',
                                lineWidth: 1.5,
                                hidden: false,
                                borderRadius: 3,
                                index: 0
                            }];
                        },
                        font: {
                            family: "'Press Start 2P'",
                            size: 10
                        }
                    }
                },
                title: {
                    display: true,
                    text: '   S&P 500: Historical Data',
                    font: {
                        family: "'Press Start 2P'",
                        size: 10,
                    },
                },
                tooltip: {
                    callbacks: {
                        // format the tooltip label to show full date as dd MMM yyyy.
                        title: (tooltipItems) => {
                            // tooltipItems is an array; we take the first item's parsed date.
                            const date = tooltipItems[0].parsed.x;
                            return new Date(date).toLocaleDateString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                            });
                        }
                    },
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
                },
                annotation: {
                    annotations: [{
                        id: 'box',
                        type: 'box',
                        xMin: effectiveStartDate,
                        xMax: effectiveEndDate,
                        yMin: yMinBox,
                        yMax: yMaxBox,
                        backgroundColor: 'rgb(0, 139, 2, 0.1)',
                        borderColor: 'rgb(0, 139, 2, 1)',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        label: {
                            enabled: true,
                            content: 'Your Game',
                            position: 'center',
                            backgroundColor: 'rgba(0,255,0,0.1)',
                            color: 'rgba(0,255,0,1)',
                            font: {
                                family: "'Press Start 2P'",
                                size: 10
                            }
                        }
                    }]
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'year',
                        displayFormats: {
                            year: 'yyyy'
                        },
                        tooltipFormat: 'dd MMM yyyy'
                    },
                    title: {
                        display: true,
                        text: 'Date      ',
                        font: {
                            family: "'Press Start 2P'",
                            size: 10,
                        },
                    },
                    ticks: {
                        font: {
                            family: "'Press Start 2P'",
                            size: 8,
                            lineHeight: 1.55
                        }
                    },
                    min: fullFirstDate,
                    max: fullLastDate
                },
                y: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Price ($)',
                        font: {
                            family: "'Press Start 2P'",
                            size: 10,
                        },
                    },
                    ticks: {
                        font: {
                            family: "'Press Start 2P'",
                            size: 8,
                            lineHeight: 1.4
                        },
                        callback: function(value) {
                            return Number(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });
});

onDestroy(() => {
    if (chart) {
        chart.destroy();
        chart = null
    }
});
</script>

<style>
.chart-container {
    margin-top: -5px;
    position: relative;
    width: 96%;
    height: 350px;
}
</style>

<div class="chart-container">
    <canvas bind:this={canvas}></canvas>
</div>
