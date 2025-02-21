import { BrowserRouter } from 'react-router-dom'
import BipartiteFlow from './pages/BipartiteFlow'
import InteractionNetwork from './pages/InteractionNetwork'
import LegislatorProfile from './pages/LegislatorProfile'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="w-screen h-screen bg-gray-900 overflow-hidden">
        <main className="w-full h-full p-4">
          <div className="w-full h-full grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="flex flex-col gap-4">
              {/* Top Left - InteractionNetwork (60%) */}
              <div className="flex-[0.6] min-h-0">
                <InteractionNetwork />
              </div>
              
              {/* Bottom Left - LegislatorProfile (40%) */}
              <div className="flex-[0.4] min-h-0">
                <LegislatorProfile />
              </div>
            </div>

            {/* Right Column - BipartiteFlow */}
            <div className="h-full min-h-0">
              <BipartiteFlow />
            </div>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
