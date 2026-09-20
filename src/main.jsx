import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PuertaApp from './PuertaApp.jsx'
import './index.css'

const search = window.location.search;
const hash = window.location.hash;
const pathname = window.location.pathname;

const isPuerta = search.includes('puerta') || hash.includes('puerta') || pathname.includes('puerta');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPuerta ? <PuertaApp /> : <App />}
  </React.StrictMode>,
)
