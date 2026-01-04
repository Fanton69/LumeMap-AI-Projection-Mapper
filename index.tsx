
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("LumeMap: Mounting started...");

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("LumeMap: Root element not found!");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("LumeMap: Render triggered");
    
    // Hide the initial HTML loader once React takes over
    const loader = document.getElementById('initial-loader');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }, 1000);
    }
  } catch (err) {
    console.error("LumeMap: Failed to render:", err);
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
      errorDisplay.style.display = 'block';
      errorDisplay.innerHTML += `<div><strong>Mount Error:</strong> ${err.message}</div>`;
    }
  }
}
