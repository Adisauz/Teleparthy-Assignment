import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { TelepartyProvider } from './teleparty/TelepartyContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TelepartyProvider>
      <App />
    </TelepartyProvider>
  </StrictMode>,
);
