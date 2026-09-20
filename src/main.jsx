import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PuertaApp from './PuertaApp.jsx'
import './index.css'

const path = window.location.pathname;
const isPuerta = path.includes('puerta');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPuerta ? <PuertaApp /> : <App />}
  </React.StrictMode>,
)
