
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CacheProvider } from './context/CacheContext';
import './index.css';

// Operator-only tool — lazy so its code (dashboard + tabs + admin API client) is never
// downloaded by public visitors, only when the /admin route is actually opened.
// eslint-disable-next-line react-refresh/only-export-components -- entry file, not HMR-refreshed
const AdminApp = React.lazy(() => import('./components/admin/AdminApp'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// /admin is a separate operator-only tool: skip the public app's providers (in-memory
// data cache) entirely and render it on its own.
if (window.location.pathname.startsWith('/admin')) {
  root.render(
    <React.StrictMode>
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    </React.StrictMode>
  );
} else {

// Global error handling for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (!reason) return;
    
    // 1. Silent non-critical network or user-abort errors
    const isObject = typeof reason === 'object';
    const message = reason instanceof Error ? reason.message : String(reason);
    const name = (isObject && (reason as any).name) || '';

    const isIgnorable = 
        name === 'AbortError' ||
        message.includes('AbortError') || 
        message.includes('cancelled') ||
        message.includes('Request aborted') ||
        message.includes('interrupted') ||
        message.includes('Network request failed') ||
        message.includes('Failed to fetch') || 
        message.includes('404') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504') ||
        message.includes('Load failed') ||
        message.includes('The play() request was interrupted') ||
        message.includes('The fetching process for the media resource was aborted by the user') ||
        name === 'NS_ERROR_FAILURE' ||
        (isObject && (reason as any).status === 0);

    if (isIgnorable) {
        event.preventDefault();
        return;
    }

    // 2. Log unhandled errors that are actually critical
    console.warn('Caught unhandled promise rejection:', reason);
    event.preventDefault(); // Stop it from bubbling and causing browser errors
});

  root.render(
    <React.StrictMode>
      <CacheProvider>
        <App />
      </CacheProvider>
    </React.StrictMode>
  );
}
