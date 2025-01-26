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
  const { hits = 0 } = props; // destructure 'hits' from props with a default value

  const [hitCount, setHitCount] = useState(parseNumber(hits)); // initialize state for hit count

  useEffect(() => {
    // function to fetch the current hit count from the Netlify getHit function
    const fetchHitCount = async () => {
      try {
        const response = await fetch('/.netlify/functions/getHit'); // adjust the path if necessary
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHitCount(parseNumber(data.count)); // update state with the fetched hit count
      } catch (error) {
        console.error('Error fetching hit count:', error);
      }
    };

    // function to increment the hit count by calling the Netlify incrementHit function
    const incrementHitCount = async () => {
      try {
        const response = await fetch('/.netlify/functions/incrementHit', {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHitCount(parseNumber(data.count)); // update state with the new hit count
      } catch (error) {
        console.error('Error incrementing hit count:', error);
      }
    };

    // fetch the current hit count when the component mounts
    fetchHitCount();

    // increment the hit count when the component mounts
    incrementHitCount();
  }, []); // empty dependency array ensures this runs once when the component mounts

  return (
    <RetroHitCounter
      hits={parseNumber(hitCount)} // pass the current hit count to the RetroHitCounter component
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