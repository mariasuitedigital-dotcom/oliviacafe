import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/src/index.css';
import { registerAppSW } from '@/src/shared/pwa/registerSW';
import ClientApp from './ClientApp';

void registerAppSW('/c/sw.js', '/c/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClientApp />
  </StrictMode>
);
