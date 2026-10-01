import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { convex } from './integrations/convex/client'
import './index.css'

createRoot(document.getElementById("root")!).render(<ConvexAuthProvider client={convex}><App /></ConvexAuthProvider>);
