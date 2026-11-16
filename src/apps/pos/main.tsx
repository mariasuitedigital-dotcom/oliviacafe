import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/src/index.css';
import { registerAppSW } from '@/src/shared/pwa/registerSW';
import PosApp from './PosApp';

void registerAppSW('/caja/sw.js', '/caja/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PosApp />
  </StrictMode>
);
