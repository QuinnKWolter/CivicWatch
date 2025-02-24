import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import theme from './theme'; // Import your custom theme
import BipartiteFlow from './components/BipartiteFlow';
import InteractionNetwork from './components/InteractionNetwork';
import LegislatorProfile from './components/LegislatorProfile';
import Sidebar from './components/Sidebar';
import './App.css'

function App() {
  const [filters, setFilters] = useState({
    interactionType: 'all',
    party: ['D', 'R'],
    state: 'all'
  });
  const [minCivility, setMinCivility] = useState(0.5);
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    civility: true,
    misinformation: true,
    statistics: true,
    topics: true
  });
  const [activeTopics, setActiveTopics] = useState(['topic1', 'topic2', 'topic3', 'topic4', 'topic5', 'topic6']);

  const handleFilterChange = (type, value) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ width: '100vw', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
          <Grid container sx={{ height: '100%' }}>
            {/* Sidebar */}
            <Grid item>
              <Sidebar
                filters={filters}
                handleFilterChange={handleFilterChange}
                expandedSections={expandedSections}
                toggleSection={toggleSection}
                minCivility={minCivility}
                setMinCivility={setMinCivility}
                activeTopics={activeTopics}
                setActiveTopics={setActiveTopics}
              />
            </Grid>

            {/* Main Content */}
            <Grid item xs>
              <Grid container spacing={2} sx={{ p: 4, height: '100%' }}>
                {/* Left Column */}
                <Grid item xs={6} container direction="column" spacing={2}>
                  {/* Top Left - InteractionNetwork */}
                  <Grid item xs={6}>
                    <Box sx={{ bgcolor: 'black', height: '100%' }}>
                      <InteractionNetwork />
                    </Box>
                  </Grid>
                  
                  {/* Bottom Left - LegislatorProfile */}
                  <Grid item xs={6}>
                    <Box sx={{ bgcolor: 'grey.700', height: '100%' }}>
                      <LegislatorProfile />
                    </Box>
                  </Grid>
                </Grid>

                {/* Right Column - BipartiteFlow */}
                <Grid item xs={6}>
                  <Box sx={{ bgcolor: 'grey.500', height: '100%' }}>
                    <BipartiteFlow activeTopics={activeTopics} />
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App