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
    precomputedSp500ChartStore
} from '../logic/store';

// accept simulation dates from App.svelte.
export let simulationStartDate = null;
export let simulationEndDate = null;

let canvas;
let chart;

let weeklyData = [];

const unsub = precomputedSp500ChartStore.subscribe(val => {
    weeklyData = val.weeklyData || [];
    createChart();
});

onMount(() => {
    if (weeklyData.length) {
        createChart();
    }
});

onDestroy(() => {
    if (chart) chart.destroy();
    unsub();
});

function createChart() {
    // if no canvas or no data, bail
    if (!canvas || !weeklyData.length) return;

    // 1. slice for the user's actual (startDate, endDate)
    const fullFirstDate = weeklyData[0]?.x;
    const fullLastDate = weeklyData[weeklyData.length - 1]?.x;
    const effectiveStart = simulationStartDate ? new Date(simulationStartDate) : fullFirstDate;
    const effectiveEnd = simulationEndDate ? new Date(simulationEndDate) : fullLastDate;

    const slicedData = weeklyData.filter(point => point.x >= effectiveStart && point.x <= effectiveEnd);

    // 2. optionally compute yMinBox / yMaxBox
    let yMinBox = null,
        yMaxBox = null;
    if (slicedData.length) {
        const yVals = slicedData.map(d => d.y);
        yMinBox = Math.min(...yVals) * 0.7;
        yMaxBox = Math.max(...yVals) * 1.5;
    }
    // destroy any existing chart
    if (chart) chart.destroy();

    chart = new Chart(canvas, {
        type: 'line',
        data: {
            // for labels, use sequential day numbers.
            datasets: [{
                data: weeklyData,
                borderColor: 'black',
                backgroundColor: 'black',
                fill: false,
                tension: 0.5,
                pointRadius: 0,
                borderWidth: 0.8
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
                                lineWidth: 1.3,
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
                        xMin: effectiveStart,
                        xMax: effectiveEnd,
                        yMin: yMinBox,
                        yMax: yMaxBox,
                        backgroundColor: 'rgb(0, 139, 2, 0.1)',
                        borderColor: 'rgb(0, 139, 2, 1)',
                        borderRadius: 10,
                        borderWidth: 1.2,
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
};
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
