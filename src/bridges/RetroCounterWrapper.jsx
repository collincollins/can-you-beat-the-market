// src/bridges/RetroCounterWrapper.jsx

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import reactToWebComponent from 'react-to-webcomponent';
import RetroHitCounter from 'react-retro-hit-counter';

// Utility functions to parse boolean and number values
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
    // Function to increment the hit count and retrieve the updated visitor count
    const incrementVisitorAndUpdateCount = async () => {
      try {
        // Count the new visitor
        const countVisitorResponse = await fetch('/.netlify/functions/countVisitor', {
          method: 'POST',
        });
        if (!countVisitorResponse.ok) {
          throw new Error(`HTTP error! status: ${countVisitorResponse.status}`);
        }
  
        // Fetch the updated visitor count
        const getVisitorResponse = await fetch('/.netlify/functions/getVisitorCount', {
          method: 'GET',
        });
        if (!getVisitorResponse.ok) {
          throw new Error(`HTTP error! status: ${getVisitorResponse.status}`);
        }
  
        // Update the state with the new visitor count
        const data = await getVisitorResponse.json();
        setVisitorCount(data.count);
      } catch (error) {
        console.error('Error updating visitor count:', error);
      }
    };
  
    incrementVisitorAndUpdateCount(); // Execute the function on component mount
  }, []); // Empty dependency array ensures this runs only once on mount

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

// Convert the React component to a Web Component
const RetroCounterElement = reactToWebComponent(RetroCounterWC, React, ReactDOM);

// Define the custom element if it hasn't been defined yet
if (!customElements.get('retro-counter')) {
  customElements.define('retro-counter', RetroCounterElement);
}