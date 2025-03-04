import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import TabA from './TabA'; // Placeholder for actual chart components
import TabB from './TabB';
import TabC from './TabC';

function TabbedCharts() {
  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Tabs value={value} onChange={handleChange} aria-label="chart tabs">
        <Tab label="Tab 1" />
        <Tab label="Tab 2" />
        <Tab label="Tab 3" />
      </Tabs>
      <Box sx={{ p: 3 }}>
        {value === 0 && (
          <>
            <Typography variant="h6">Tab 1 Content</Typography>
            <TabA />
          </>
        )}
        {value === 1 && (
          <>
            <Typography variant="h6">Tab 2 Content</Typography>
            <TabB />
          </>
        )}
        {value === 2 && (
          <>
            <Typography variant="h6">Tab 3 Content</Typography>
            <TabC />
          </>
        )}
      </Box>
    </Box>
  );
}

export default TabbedCharts; 