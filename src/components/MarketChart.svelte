<!-- src/components/MarketChart.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend } from 'chart.js';
    import { marketData } from '../logic/store';
  
    // register necessary Chart.js components
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
  
    let chart;           // reference to the chart instance
    let ctx = null;      // canvas context
  
    // initial chart data structure
    let data = {
      labels: [],
      datasets: [
        {
          label: 'Market Price',
          data: [],
          borderColor: 'black',
          pointStyle: 'line',
          borderWidth: 1,
          fill: false,
          pointRadius: 0, // hide individual points for smoother lines
        },
        {
          label: 'Buy Event',
          data: [],
          backgroundColor: 'green',
          pointStyle: 'circle',
          pointRadius: 5,
          showLine: false,
        },
        {
          label: 'Sell Event',
          data: [],
          backgroundColor: 'red',
          pointStyle: 'circle',
          pointRadius: 5,
          showLine: false,
        }
      ],
    };
  
    // chart configuration options with y-axis limits
    let options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: 'linear',
          suggestedMin: 0,
          suggestedMax: 1000,
          title: {
            display: true,
            text: 'Days',
          },
        },
        y: {
          suggestedMin: 0,    
          suggestedMax: 150,  
          title: {
            display: true,
            text: 'Price ($)',
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true
          }
        },
        title: {
          display: false,
        },
        tooltip: {
          enabled: true,
        }
      },
    };
  
    let unsubscribe; // to store the unsubscribe function for the store
  
    // initialize the chart on component mount
    onMount(() => {
      if (ctx) {
        chart = new Chart(ctx, {
          type: 'line',
          data,
          options,
        });
  
        // subscribe to marketData store updates
        unsubscribe = marketData.subscribe(newData => {
          chart.data.labels = newData.days;
          chart.data.datasets[0].data = newData.marketPrices;
  
          // extract buy and sell actions
          const buyActions = newData.actions
            .filter(action => action.type === 'buy')
            .map(action => ({
              x: action.day,
              y: newData.marketPrices[action.day - 1] || newData.marketPrices[0],
            }));
  
          const sellActions = newData.actions
            .filter(action => action.type === 'sell')
            .map(action => ({
              x: action.day,
              y: newData.marketPrices[action.day - 1] || newData.marketPrices[0],
            }));
  
          // updatebBuy and sell sctions datasets
          chart.data.datasets[1].data = buyActions;
          chart.data.datasets[2].data = sellActions;
  
          // update the chart
          chart.update('none');
        });
      }
    });
  
    // clean up on component destroy
    onDestroy(() => {
      if (chart) chart.destroy();
      if (unsubscribe) unsubscribe();
    });
  </script>
  
  <style>
    .chart-container {
      position: relative;
      height: 400px; 
      width: 100%;
      font-size: 0.5em; 
    }
  </style>
  
  <!-- anvas element for Chart.js -->
  <div class="chart-container">
    <canvas bind:this={ctx}></canvas>
  </div>