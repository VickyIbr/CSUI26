import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from '@/app/router';
import './index.css';

const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBase}>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
