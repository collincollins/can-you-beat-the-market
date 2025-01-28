<script>
  import { createEventDispatcher } from 'svelte';

  let playerName = '';
  let errorMessage = '';
  const dispatch = createEventDispatcher();

  function submitName() {
    const trimmedName = playerName.trim();

    // Reset error message
    errorMessage = '';

    // Validate trimmedName is not empty
    if (trimmedName === '') {
      errorMessage = 'Username cannot be empty.';
      return;
    }

    // Validate length of the username
    if (trimmedName.length > 16) {
      errorMessage = 'Username must be 16 characters or fewer.';
      return;
    }

    // Dispatch the trimmed name if valid
    dispatch('submit', trimmedName);
  }

  function handleInput(event) {
    playerName = event.target.value;

    // Real-time validation
    if (playerName.length > 16) {
      errorMessage = 'Username must be 16 characters or fewer.';
    } else {
      errorMessage = '';
    }
  }
</script>

<div class="modal-overlay">
  <div class="modal">
    <h2>New High Score!</h2>
    <p>Please enter your name:</p>
    <input
      type="text"
      bind:value={playerName}
      placeholder="Your Name"
      class:invalid={errorMessage !== ''}
      on:input={handleInput}
    />
    {#if errorMessage}
      <p class="error-message">{errorMessage}</p>
    {/if}
    <button on:click={submitName} disabled={errorMessage !== '' || playerName.trim() === ''}>
      Submit
    </button>
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
    background-color: #F3F4F6;
    font-family: 'Press Start 2P', cursive;
    font-size: 0.9em;
    width: 70%;
    border: 1px solid #ccc;
    border-radius: 5px;
    text-align: center;
    transition: border-color 0.3s;
  }

  input.invalid {
    border-color: red; /* Highlight invalid input with red border */
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

  button:disabled {
    background-color: #a0a0a0;
    cursor: not-allowed;
  }

  button:hover:enabled {
    background-color: #006f00;
  }

  .error-message {
    color: red;
    font-size: 0.7em;
    margin-top: -5px;
  }
</style>