<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    CategoryScale,
    Tooltip,
    Legend,
  } from 'chart.js';
  import { marketData } from '../logic/store';
  import annotationPlugin from 'chartjs-plugin-annotation';

  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    CategoryScale,
    Tooltip,
    Legend,
    annotationPlugin
  );

  let chart;
  let ctx;


  // Use the first market price as the starting price.
  // In simulated mode, this will be 100; in real mode, it will be the starting price from the S&P500 historical data.
  $: initialPrice = ($marketData.marketPrices && $marketData.marketPrices.length)
      ? $marketData.marketPrices[0]
      : 100;

  // Compute the suggested limits and round them to the nearest integer.
  $: roundedYMin = Math.round(initialPrice * 0.95);
  $: roundedYMax = Math.round(initialPrice * 1.10);


  const data = {
    labels: [],
    datasets: [
      {
        // Rolling average line
        label: 'Market Price ',
        data: [],
        borderColor: 'black',
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: .5,
      },
      {
        label: 'Buy Event ',
        data: [],
        backgroundColor: '#008b02',
        pointStyle: 'circle',
        pointRadius: 5.5,
        showLine: false,
      },
      {
        label: 'Sell Event',
        data: [],
        backgroundColor: '#f44336',
        pointStyle: 'circle',
        pointRadius: 5.5,
        showLine: false,
      },
    ],
  };

  $: options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        type: 'linear',
        suggestedMin: 0,
        suggestedMax: 500,
        title: {
          display: true,
          text: 'Days  ', // tactical spaces to make the text centered
          font: {
            family: "'Press Start 2P'",
            size: 10,
          },
        },
        ticks: {
          font: {
            family: "'Press Start 2P'",
            size: 8,
          },
        },
      },
      y: {
        suggestedMin: roundedYMin,
        suggestedMax: roundedYMax,
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
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          usePointStyle: true,
          font: {
            family: "'Press Start 2P'",
            size: 8.5,
          },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
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
      },
    },
  };

  // reactive block to update the chart instance when roundedYMin or roundedYMax change.
  $: if (chart) {
    chart.options.scales.y.suggestedMin = roundedYMin;
    chart.options.scales.y.suggestedMax = roundedYMax;
    chart.update('none');
  }

  let unsubscribe;

  function initializeChart() {
    if (ctx) {
      chart = new Chart(ctx, {
        type: 'line',
        data,
        options,
      });
      unsubscribe = marketData.subscribe(newData => {
        chart.data.datasets[0].data = newData.rollingAverages.map((ra, i) => ({
          x: newData.days[i],
          y: ra,
        }));

        const buyActions = newData.actions
          .filter(a => a.type === 'buy')
          .map(a => ({ x: a.day, y: a.executedPrice }));
        const sellActions = newData.actions
          .filter(a => a.type === 'sell')
          .map(a => ({ x: a.day, y: a.executedPrice }));

        chart.data.datasets[1].data = buyActions;
        chart.data.datasets[2].data = sellActions;

        chart.update('none');
      });
    }
  }

  onMount(() => {
    // wait for fonts to load before rendering the chart
    document.fonts.ready.then(() => {
      initializeChart();
    }).catch(() => {
      console.error('Fonts failed to load, initializing chart anyway...');
      initializeChart();
    });
  });

  onDestroy(() => {
    if (chart) chart.destroy();
    chart = null;
    if (unsubscribe) unsubscribe();
  });
</script>

<style>
.chart-container {
  position: relative;
  height: 250px;
  width: 95%;
  max-width: 800px;
}
</style>

<div class="chart-container">
  <canvas bind:this={ctx}></canvas>
</div>