import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { convex } from './integrations/convex/client'
import './index.css'

// Keep credentials scoped to the canonical host, including links to old group URLs.
if (window.location.hostname === 'elo.apps.janjaap.de') {
  window.location.replace(`https://elo.janjaap.de${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
  createRoot(document.getElementById("root")!).render(<ConvexAuthProvider client={convex}><App /></ConvexAuthProvider>);
}
