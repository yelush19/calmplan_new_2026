import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ── Process Tree test harness (TEMPORARY — remove after Step 1 validation) ──
window.testProcessTree = async () => {
  const { testProcessTree } = await import('@/services/testProcessTree');
  return testProcessTree();
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)