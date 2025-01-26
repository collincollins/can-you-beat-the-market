import React from 'react';
import ReactDOM from 'react-dom/client';
import reactToWebComponent from 'react-to-webcomponent';
import RetroHitCounter from 'react-retro-hit-counter';

function parseBool(val) {
  return val === 'true' || val === true;
}

function parseNumber(val, fallback = 0) {
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

function RetroCounterWC(props) {
  const {
    hits = 10,
  } = props;

  return (
    <RetroHitCounter
      hits={parseNumber(hits)}
      withBorder={parseBool(true)}
      withGlow={parseBool(true)}
      minLength={parseInt(7)}
      size={parseInt(20)}
      padding={parseInt(4)}
      digitSpacing={parseInt(3)}
      segmentThickness={parseInt(3)}
      segmentSpacing={parseFloat(0.5)}
      segmentActiveColor={'#76FF03'}
      segmentInactiveColor={'#315324'}
      backgroundColor={'#222222'}
      borderThickness={parseInt(5)}
      glowStrength={parseInt(1)}
    />
  );
}

const RetroCounterElement = reactToWebComponent(RetroCounterWC, React, ReactDOM);

if (!customElements.get('retro-counter')) {
  customElements.define('retro-counter', RetroCounterElement);
}