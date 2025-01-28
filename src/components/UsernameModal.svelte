<!-- src/components/UsernameModal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  let playerName = '';
  const dispatch = createEventDispatcher();

  function submitName() {
    if (playerName.trim() !== '') {
      dispatch('submit', playerName.trim());
    }
  }
</script>

<div class="modal-overlay">
  <div class="modal">
    <h2>New High Score!</h2>
    <p>Please enter your name:</p>
    <input type="text" bind:value={playerName} placeholder="Your Name" />
    <button on:click={submitName}>Submit</button>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .modal {
    background: white;
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 15px;
    padding-bottom: 20px;
    border-radius: 10px;
    border: 3px solid #000000;
    box-shadow: 3px 3px 0px #000000;
    text-align: center;
    width: 70%;
    font-size: 0.95em;
  }

  input {
    padding: 10px;
    margin-bottom: 20px;
    background-color: F3F4F6;
    font-family: 'Press Start 2P', cursive;
    font-size: 0.9em;
    width: 70%;
    border: 1px solid #ccc;
    border-radius: 5px;
    text-align: center;
  }

  button {
    font-family: 'Press Start 2P', cursive;
    touch-action: manipulation;
    background-color: #008b02;
    border: 2px solid black;
    color: white;
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 10px;
    padding-bottom: 10px;
    text-align: center;
    box-shadow: 2px 2px 0px black;
    border-radius: 10px;
    font-size: 1.2em;
    margin-bottom: 10px;
    cursor: pointer;
  }

  button:hover {
    background-color: #006f00;
  }
</style>