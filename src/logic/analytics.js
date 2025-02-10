// src/logic/analytics.js

/**
 * logs a "coffee click" event using either the Beacon API or a fetch call.
 * this function sends a POST request to the Netlify function endpoint
 * with the current timestamp, which can later be used for analytics purposes.
 */
export async function logCoffeeClick() {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString()
    });
    
    const url = '/.netlify/functions/logCoffeeClick';
    
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      try {
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: payload,
          keepalive: true // ensures the request completes even during page unload
        });
      } catch (error) {
        console.error('Error logging coffee click:', error);
      }
    }
  }