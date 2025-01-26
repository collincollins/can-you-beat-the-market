<!-- src/components/Controls.svelte -->
<script>
  import { sendBuySignal, sendSellSignal } from '../logic/simulation';
  import { createEventDispatcher } from 'svelte';
  import { userPortfolio } from '../logic/store';
  import { onDestroy } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let canBuy = false;
  let canSell = false;
  
  // subscribe to userPortfolio to determine if user can buy or sell
  const unsubscribe = userPortfolio.subscribe(value => {
    canBuy = value.cash > 0;
    canSell = value.shares > 0;
  });
  
  onDestroy(() => {
    unsubscribe();
  });
  
  function handleBuy() {
    sendBuySignal();
    dispatch('buy');
  }
  
  function handleSell() {
    sendSellSignal();
    dispatch('sell');
  }
</script>

<style>
  .controls {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    font-size: 0.5em;
  }

  button {
    font-family: 'Press Start 2P', cursive;
    touch-action: manipulation;
    border: 2px solid black;
    color: white;
    padding: 10px 24px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    box-shadow: 2px 2px 0px black;
    font-size: 3em;
    margin: 10px 5spx;
    cursor: pointer;
    border-radius: 5px;
  }
  
  .sell {
    background-color: #f44336;
    border-radius: 10px;
    font-size: 5em;
    margin-top: -5px;
    margin-bottom: 0px;
  }

  .buy {
    background-color: #008b02;
    border-radius: 10px;
    font-size: 5em;
    margin-top: -5px;
    margin-bottom: 0px;
  }
</style>

<div class="controls">
  {#if canBuy}
    <button class="buy" on:click={handleBuy}>Buy</button>
  {/if}
  
  {#if canSell}
    <button class="sell" on:click={handleSell}>Sell</button>
  {/if}
</div>