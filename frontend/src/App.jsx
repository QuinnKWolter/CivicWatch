import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import LegislatorProfile from './pages/LegislatorProfile'
import BipartiteFlow from './pages/BipartiteFlow'
import InteractionNetwork from './pages/InteractionNetwork'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        {/* Enhanced Navigation Header */}
        <nav className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              {/* Logo and Brand */}
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl font-bold">CW</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  CivicWatch
                </div>
              </div>
              
              {/* Enhanced Navigation Links */}
              <div className="flex space-x-2">
                <NavLink 
                  to="/" 
                  className={({ isActive }) =>
                    `px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'text-white bg-gray-700/50 shadow-inner' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
                    }`
                  }
                >
                  Legislator Profile
                </NavLink>
                <NavLink 
                  to="/flow" 
                  className={({ isActive }) =>
                    `px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'text-white bg-gray-700/50 shadow-inner' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
                    }`
                  }
                >
                  Bipartite Flow
                </NavLink>
                <NavLink 
                  to="/network" 
                  className={({ isActive }) =>
                    `px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'text-white bg-gray-700/50 shadow-inner' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
                    }`
                  }
                >
                  Interaction Network
                </NavLink>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="max-w-8xl mx-auto px-6 py-8 lg:px-8">
          <Routes>
            <Route path="/" element={<LegislatorProfile />} />
            <Route path="/flow" element={<BipartiteFlow />} />
            <Route path="/network" element={<InteractionNetwork />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
