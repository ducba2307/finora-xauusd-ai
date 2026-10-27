import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary, RootErrorFallback } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={(error, reset) => <RootErrorFallback error={error} reset={reset} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

