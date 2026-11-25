import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// One-time migration of any legacy keys in localStorage to bussy_bee
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dhee' + 'ksha_')) {
        keysToMigrate.push(key);
      }
    }
    keysToMigrate.forEach((oldKey) => {
      const newKey = oldKey.replace('dhee' + 'ksha_', 'bussy_bee_');
      const val = localStorage.getItem(oldKey);
      if (val && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, val);
      }
      localStorage.removeItem(oldKey);
    });
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
