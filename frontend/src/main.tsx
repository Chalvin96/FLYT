import * as Sentry from '@sentry/react';
import { domMax, LazyMotion } from 'motion/react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

import './index.css';

import App from './App.tsx';

if (import.meta.env.FLYT_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.FLYT_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.FLYT_RELEASE,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domMax}>
      <App />
    </LazyMotion>
  </StrictMode>,
);
