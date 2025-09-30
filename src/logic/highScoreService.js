// src/logic/highScoreService.js

export async function fetchHighScore() {
    try {
      const response = await fetch('/.netlify/functions/getHighScore');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data; // { score, playerName }
    } catch (error) {
      console.error('Error fetching high score:', error);
      return { score: 0, playerName: 'No one yet' };
    }
  }
  
  export async function updateHighScore(playerName, score) {
    try {
      const response = await fetch('/.netlify/functions/setHighScore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerName, score })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      await response.json();
      return true;
    } catch (error) {
      console.error('Error updating high score:', error);
      return false;
    }
  }