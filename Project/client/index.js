import './src/utils/crypto-polyfill';

import { registerRootComponent } from 'expo';
import React from 'react';

import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

registerRootComponent(AppWithErrorBoundary);
