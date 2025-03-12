import React from 'react';
import { Box, Typography, Button, Checkbox, FormControlLabel, Select, MenuItem, Slider } from '@mui/material';

function Sidebar({ filters, handleFilterChange, expandedSections, toggleSection, minCivility, setMinCivility, activeTopics, setActiveTopics }) {
  return (
    <Box sx={{ width: 250, bgcolor: 'grey.800', p: 2, height: '100vh', overflowY: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={() => toggleSection('filters')}
        >
          Basic Filters
        </Button>
        {expandedSections.filters && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Interaction Type
            </Typography>
            <Select
              fullWidth
              value={filters.interactionType}
              onChange={(e) => handleFilterChange('interactionType', e.target.value)}
            >
              <MenuItem value="all">All Interactions</MenuItem>
              <MenuItem value="mentions">Mentions</MenuItem>
              <MenuItem value="replies">Replies</MenuItem>
              <MenuItem value="retweets">Retweets</MenuItem>
            </Select>

            <Typography variant="subtitle1" color="textSecondary" sx={{ mt: 2 }}>
              Party
            </Typography>
            {['D', 'R'].map(party => (
              <FormControlLabel
                key={party}
                control={
                  <Checkbox
                    checked={filters.party.includes(party)}
                    onChange={(e) => {
                      const newParties = e.target.checked
                        ? [...filters.party, party]
                        : filters.party.filter(p => p !== party);
                      handleFilterChange('party', newParties);
                    }}
                  />
                }
                // label={party === 'D' ? 'Democrat' : 'Republican'}
                label={party === 'D' ? 'Separated' : 'Aggregated'}
              />
            ))}

            <Typography variant="subtitle1" color="textSecondary" sx={{ mt: 2 }}>
              State
            </Typography>
            <Select
              fullWidth
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
            >
              <MenuItem value="all">All States</MenuItem>
              {['CA', 'TX', 'NY', 'FL'].map(state => (
                <MenuItem key={state} value={state}>{state}</MenuItem>
              ))}
            </Select>
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={() => toggleSection('civility')}
        >
          Civility Settings
        </Button>
        {expandedSections.civility && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Minimum Civility Score
            </Typography>
            <Slider
              value={minCivility}
              min={0}
              max={1}
              step={0.1}
              onChange={(e, value) => setMinCivility(value)}
            />
          </Box>
        )}
      </Box>

      <Box>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={() => toggleSection('misinformation')}
        >
          Misinformation Settings
        </Button>
        {expandedSections.misinformation && (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={<Checkbox />}
              label="Show Misinformation Flags"
            />
            <FormControlLabel
              control={<Checkbox />}
              label="Hide High-Risk Connections"
            />
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={() => toggleSection('topics')}
        >
          Topic Settings
        </Button>
        {expandedSections.topics && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Topics
            </Typography>
            {['topic1', 'topic2', 'topic3', 'topic4', 'topic5', 'topic6'].map(topic => (
              <FormControlLabel
                key={topic}
                control={
                  <Checkbox
                    checked={activeTopics.includes(topic)}
                    onChange={(e) => {
                      const newTopics = e.target.checked
                        ? [...activeTopics, topic]
                        : activeTopics.filter(t => t !== topic);
                      setActiveTopics(newTopics);
                    }}
                  />
                }
                label={`Topic ${topic.slice(-1)}`}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Sidebar; 