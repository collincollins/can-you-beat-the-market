<!-- src/components/MarketChart.svelte -->
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

  // Register Chart.js components
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    CategoryScale,
    Tooltip,
    Legend
  );

  let chart;
  let ctx;

  // Prepare the datasets
  const data = {
    labels: [],
    datasets: [
      {
        // rolling average line
        label: 'Market Price ',
        data: [],
        borderColor: 'black',
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: 0
      },
      {
        // Buy markers
        label: 'Buy Event ',
        data: [],
        backgroundColor: '#008b02',
        pointStyle: 'circle',
        pointRadius: 6,
        showLine: false,
      },
      {
        // sell markers
        label: 'Sell Event',
        data: [],
        backgroundColor: 'red',
        pointStyle: 'circle',
        pointRadius: 6,
        showLine: false,
      }
    ],
  };

  // chart options
  const options = {
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
          text: 'Days',
          font: {
            family: "'Press Start 2P'",
            size: 12
          }
        },
        ticks: {
          font: {
            family: "'Press Start 2P'",
            size: 9
          }
        }
      },
      y: {
        suggestedMin: 95,
        suggestedMax: 110,
        title: {
          display: true,
          text: 'Price ($)',
          font: {
            family: "'Press Start 2P'",
            size: 12
          }
        },
        ticks: {
          font: {
            family: "'Press Start 2P'",
            size: 9
          }
        }
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          usePointStyle: true,
          font: {
            family: "'Press Start 2P'",
            size: 8.5
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: true
      }
    },
  };

  let unsubscribe;

  onMount(() => {
    if (ctx) {
      // Initialize the Chart.js instance
      chart = new Chart(ctx, {
        type: 'line',
        data,
        options
      });

      // Subscribe to marketData updates
      unsubscribe = marketData.subscribe(newData => {
        // Update rolling-average line
        chart.data.datasets[0].data = newData.rollingAverages.map((ra, i) => ({
          x: newData.days[i],
          y: ra
        }));

        // Update buy and sell actions
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
  });

  onDestroy(() => {
    if (chart) chart.destroy();
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