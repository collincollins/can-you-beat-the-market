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
    // Function to fetch the current visitor count from the Netlify getVisitorCount function
    const fetchVisitorCount = async () => {
      try {
        const response = await fetch('/.netlify/functions/getVisitorCount');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setVisitorCount(parseNumber(data.count)); // update state with the fetched visitor count
      } catch (error) {
        console.error('Error fetching visitor count:', error);
      }
    };

    // Function to increment the hit count by calling the Netlify incrementHit function
    const incrementHitCount = async () => {
      try {
        const response = await fetch('/.netlify/functions/incrementHit', {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Hits are reported but not displayed
      } catch (error) {
        console.error('Error incrementing hit count:', error);
      }
    };

    // Fetch the current visitor count when the component mounts
    fetchVisitorCount();

    // Increment the hit count when the component mounts
    incrementHitCount();
  }, []); // empty dependency array ensures this runs once when the component mounts

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