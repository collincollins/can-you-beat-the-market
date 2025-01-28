<!-- src/components/Controls.svelte -->

<script>
  /**
   * Controls Component
   * 
   * Provides "Buy" and "Sell" buttons for managing the user's portfolio.
   * Buttons are conditionally rendered based on the `canBuy` and `canSell` props.
   * 
   * Props:
   * - canBuy (boolean): Determines if the "Buy" button should be displayed.
   * - canSell (boolean): Determines if the "Sell" button should be displayed.
   * 
   * Events:
   * - buy: Emitted when the "Buy" button is clicked.
   * - sell: Emitted when the "Sell" button is clicked.
   */

  import { createEventDispatcher } from 'svelte';

  // Props passed from the parent component
  export let canBuy = false;
  export let canSell = false;

  const dispatch = createEventDispatcher();

  /**
   * Handles the "Buy" button click.
   * Dispatches a 'buy' event.
   */
  function handleBuy() {
    dispatch('buy');
  }

  /**
   * Handles the "Sell" button click.
   * Dispatches a 'sell' event.
   */
  function handleSell() {
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
    margin: 10px 5px;
    cursor: pointer;
    border-radius: 5px;
  }
  
  .sell {
    background-color: #f44336;
    border-radius: 10px;
    font-size: 4em;
    margin-top: -10px;
    margin-bottom: 10px;
  }

  .buy {
    background-color: #008b02;
    border-radius: 10px;
    font-size: 4em;
    margin-top: -10px;
    margin-bottom: 10px;
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