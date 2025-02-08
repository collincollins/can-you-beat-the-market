// src/logic/visitorCountStore.js

import { writable } from './store';

export const visitorCount = writable(0);

// function to fetch the current visitor count
export const fetchVisitorCount = async () => {
  try {
    const response = await fetch('/.netlify/functions/getVisitorCount', {
      method: 'GET',
    });
    const data = await response.json();
    visitorCount.set(data.count);
  } catch (error) {
    console.error('Error fetching visitor count:', error);
  }
};