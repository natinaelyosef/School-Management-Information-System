import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './stores/AuthContext';
import { ChildProvider } from './stores/ChildContext';
import { ThemeProvider } from './stores/ThemeContext';
import { SchoolProvider } from './stores/SchoolContext';
import { registerServiceWorker } from './hooks/useServiceWorker';
import './i18n';

registerServiceWorker();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Return-to-tab and reconnect should surface fresh data without a manual
      // reload, which is what staff expect from a "live" system.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SchoolProvider>
            <ChildProvider>
              <App />
            </ChildProvider>
          </SchoolProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
