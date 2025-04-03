import React, { useEffect, useState } from 'react';
import StackedAreaChart from './StackedAreaChart';
import AccountabilityLineChart from './AccountabilityLineChart';
import TimelineSlider from './TimelineSlider';
import defaultData from '../data/defaultBipartite.json'; // Import the default JSON file
import PropTypes from 'prop-types';

const colorMap = {
  abortion: { D: '#1E3A8A', R: '#7F1D1D' },
  blacklivesmatter: { D: '#2563EB', R: '#B91C1C' },
  climate: { D: '#3B82F6', R: '#DC2626' },
  gun: { D: '#60A5FA', R: '#EF4444' },
  immigra: { D: '#93C5FD', R: '#F87171' },
  rights: { D: '#BFDBFE', R: '#FCA5A5' },
  // Add more topics as needed
};

function BipartiteFlow({ activeTopics, startDate, endDate }) {
  const [data, setData] = useState(defaultData);
  const containerRef = React.useRef(null);

  useEffect(() => {
    // Determine whether to use default data or fetch from the server
    if (!startDate && !endDate) {
    // if (!startDate && !endDate && false) {
      console.log('Using default data');
      setData(defaultData);
    } else {
      console.log('Fetching data from server');
      fetch('http://localhost:8000/api/flow/bipartite/')
        .then(response => response.json())
        .then(data => {
          console.log('Bipartite Flow Data:', data);
          setData(data);
        })
        .catch(error => console.error('Error fetching bipartite flow data:', error));
    }
  }, [startDate, endDate]);

  const handleDateChange = (newStart, newEnd) => {
    console.log('Date range changed:', newStart, newEnd);
    // You might want to fetch new data here or update the parent component
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col">
      <div className="h-[25%] min-h-[100px]">
        <AccountabilityLineChart />
      </div>
      <div className="h-[37.5%] min-h-[150px]">
        <StackedAreaChart 
          data={data} 
          activeTopics={activeTopics} 
          colorMap={colorMap} 
          inverted={false}
        />
      </div>
      <div className="h-[40px] flex items-center justify-center">
        <TimelineSlider 
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />
      </div>
      <div className="h-[37.5%] min-h-[150px]">
        <StackedAreaChart 
          data={data} 
          activeTopics={activeTopics} 
          colorMap={colorMap} 
          inverted={true}
        />
      </div>
    </div>
  );
}

BipartiteFlow.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object,
  endDate: PropTypes.object
};

export default BipartiteFlow;
