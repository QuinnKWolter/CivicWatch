import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SummaryLegislatorScatter } from './components/SummaryLegislatorScatter.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* <SummaryLegislatorScatter width={1000} height={1000}/> */}
  </StrictMode>,
)
