import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/allura/latin-400.css'
import './styles/basis.css'
import './styles/rahmen.css'
import './styles/seiten.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline-Fähigkeit und schnelles Laden (nur im fertigen Build).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}
