import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerComponents } from '@deckhand/components';
import { App } from './App';
import './styles/global.css';

// Register web components before React renders
registerComponents();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
