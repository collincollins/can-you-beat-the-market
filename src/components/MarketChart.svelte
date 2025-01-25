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
      Legend
    } from 'chart.js';
    import { marketData } from '../logic/store';
  
    // register all necessary Chart.js components
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
    let ctx = null;
  
    // prepare the datasets
    let data = {
      labels: [],
      datasets: [
        {
          // rolling-average line
          label: 'Market Price',
          data: [],
          borderColor: 'black',
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0
        },
        {
          // buy markers
          label: 'Buy Event',
          data: [],
          backgroundColor: 'green',
          pointStyle: 'circle',
          pointRadius: 5,
          showLine: false,
        },
        {
          // sell markers
          label: 'Sell Event',
          data: [],
          backgroundColor: 'red',
          pointStyle: 'circle',
          pointRadius: 5,
          showLine: false,
        }
      ],
    };
  
    // chart options
    let options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: 'linear',
          suggestedMin: 0,
          suggestedMax: 1825,
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
          suggestedMin: 900,
          suggestedMax: 1200,
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
          display: true,
          labels: {
            usePointStyle: true,
            font: {
              family: "'Press Start 2P'",
              size: 9
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
        // create the Chart.js instance
        chart = new Chart(ctx, {
          type: 'line',
          data,
          options
        });
  
        // subscribe to marketData store updates
        unsubscribe = marketData.subscribe(newData => {
          // 1) rolling-average line
          chart.data.datasets[0].data = newData.rollingAverages.map((ra, i) => ({
            x: newData.days[i],
            y: ra
          }));
  
          // 2) buy & sell
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
      height: 350px;
      width: 95%;
    }
  </style>
  
  <div class="chart-container">
    <canvas bind:this={ctx}></canvas>
  </div>