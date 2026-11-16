import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/src/index.css';
import { registerAppSW } from '@/src/shared/pwa/registerSW';
import AdminApp from './AdminApp';

void registerAppSW('/admin/sw.js', '/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>
);
