<script>
  import { createEventDispatcher } from 'svelte';

  export let isSignup = false; // Toggle between signup and login
  
  let username = '';
  let errorMessage = '';
  let isCheckingUsername = false;
  const dispatch = createEventDispatcher();

  function toggleMode() {
    isSignup = !isSignup;
    errorMessage = '';
    username = '';
  }

  function handleClose() {
    dispatch('close');
  }

  async function handleSubmit() {
    const trimmedUsername = username.trim();

    // Reset error message
    errorMessage = '';

    // Validate username is not empty
    if (trimmedUsername === '') {
      errorMessage = 'Username cannot be empty.';
      return;
    }

    // Validate length of the username
    if (trimmedUsername.length > 16) {
      errorMessage = 'Username must be 16 characters or fewer.';
      return;
    }

    // Validate alphanumeric + underscores only
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      errorMessage = 'Username can only contain letters, numbers, and underscores.';
      return;
    }

    if (isSignup) {
      // Check if username exists
      isCheckingUsername = true;
      try {
        const response = await fetch('/.netlify/functions/checkUsername', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: trimmedUsername })
        });
        const result = await response.json();
        
        if (result.exists) {
          errorMessage = 'Username already taken. Please choose another.';
          isCheckingUsername = false;
          return;
        }
      } catch (error) {
        errorMessage = 'Error checking username. Please try again.';
        isCheckingUsername = false;
        return;
      }
      isCheckingUsername = false;
    }

    // Dispatch the action (signup or login)
    dispatch('submit', { username: trimmedUsername, isSignup });
  }

  function handleInput(event) {
    username = event.target.value;

    // Real-time validation
    if (username.length > 16) {
      errorMessage = 'Username must be 16 characters or fewer.';
    } else if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      errorMessage = 'Only letters, numbers, and underscores allowed.';
    } else {
      errorMessage = '';
    }
  }
</script>

<div class="modal-overlay" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()} role="button" tabindex="-1">
  <div class="modal" on:click|stopPropagation on:keydown role="dialog" tabindex="0">
    <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>
    <p>{isSignup ? 'Create a username to save your progress' : 'Enter your username to continue'}</p>
    <input
      type="text"
      bind:value={username}
      placeholder="Username"
      class:invalid={errorMessage !== ''}
      on:input={handleInput}
      maxlength="16"
    />
    {#if errorMessage}
      <p class="error-message">{errorMessage}</p>
    {/if}
    <button 
      on:click={handleSubmit} 
      disabled={errorMessage !== '' || username.trim() === '' || isCheckingUsername}
    >
      {isCheckingUsername ? 'Checking...' : (isSignup ? 'Sign Up' : 'Log In')}
    </button>
    <button class="secondary" on:click={toggleMode}>
      {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
    </button>
    <button class="secondary cancel" on:click={handleClose}>
      Cancel
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
    z-index: 1000;
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
    max-width: 400px;
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
    border-color: red;
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
    width: 80%;
  }

  button:disabled {
    background-color: #a0a0a0;
    cursor: not-allowed;
  }

  button:hover:enabled {
    background-color: #006f00;
  }

  button.secondary {
    background-color: #435b9f;
    font-size: 0.7em;
    padding-top: 8px;
    padding-bottom: 8px;
    margin-bottom: 5px;
  }

  button.secondary:hover:enabled {
    background-color: #384d86;
  }

  button.cancel {
    background-color: #878282;
  }

  button.cancel:hover:enabled {
    background-color: #6b6b6b;
  }

  .error-message {
    color: red;
    font-size: 0.7em;
    margin-top: -15px;
    margin-bottom: 10px;
  }
</style>
