// src/bridges/RetroCounterWrapper.jsx

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import reactToWebComponent from 'react-to-webcomponent';
import RetroHitCounter from 'react-retro-hit-counter';

// utility functions to parse boolean and number values
function parseBool(val) {
  return val === 'true' || val === true;
}

function parseNumber(val, fallback = 0) {
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

function RetroCounterWC(props) {
  const { visitors = 0 } = props; // destructure 'visitors' from props with a default value
  const [visitorCount, setVisitorCount] = useState(parseNumber(visitors)); // initialize state for visitor count

  useEffect(() => {
    // function to increment the hit count and retrieve the updated visitor count
    const updateVisitorCount = async () => {
      try {
        // Check cache first (5 minute cache)
        const cached = localStorage.getItem('visitorCountCache');
        if (cached) {
          const { count, timestamp } = JSON.parse(cached);
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          if (timestamp > fiveMinutesAgo) {
            setVisitorCount(count);
            return;
          }
        }

        // fetch the count of unique visitors
        const response = await fetch('/.netlify/functions/getVisitorCount', {
          method: 'GET',
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setVisitorCount(data.count);
        
        // Cache the result
        localStorage.setItem('visitorCountCache', JSON.stringify({
          count: data.count,
          timestamp: Date.now()
        }));
        } catch (error) {
        console.error('Error fetching visitor count:', error);
        }
    };
  
    updateVisitorCount(); // execute function on component mount
  }, []); // empty dependency array ensures this runs only once on mount

  return (
    <RetroHitCounter
      hits={parseNumber(visitorCount)} // pass the current visitor count to the RetroHitCounter component
      withBorder={parseBool(true)}
      withGlow={parseBool(true)}
      minLength={7}
      size={20}
      padding={4}
      digitSpacing={3}
      segmentThickness={3}
      segmentSpacing={0.5}
      segmentActiveColor={'#76FF03'}
      segmentInactiveColor={'#315324'}
      backgroundColor={'#222222'}
      borderThickness={5}
      glowStrength={1}
    />
  );
}

// convert the React component to a Web Component
const RetroCounterElement = reactToWebComponent(RetroCounterWC, React, ReactDOM);

// define the custom element if it hasn't been defined yet
if (!customElements.get('retro-counter')) {
  customElements.define('retro-counter', RetroCounterElement);
}