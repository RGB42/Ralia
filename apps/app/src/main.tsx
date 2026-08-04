import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Reihenfolge zaehlt: Fonts vor Tokens vor Reset. Der Reset benutzt Tokens,
// und @import in fonts.css muss vor allen Regeln stehen.
import '@ralia/ui/tokens/fonts.css';
import '@ralia/ui/tokens/tokens.css';
import '@ralia/ui/tokens/reset.css';
import { App } from './App.js';

const host = document.getElementById('root');
if (!host) throw new Error('#root fehlt in index.html');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
