import React, { useEffect, useState } from 'react';
import StackedAreaChart from './StackedAreaChart';
import AccountabilityLineChart from './AccountabilityLineChart';
import TimelineSlider from './TimelineSlider';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { FaSpinner } from 'react-icons/fa';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const colorMap = {
  abortion: { D: '#1E3A8A', R: '#7F1D1D', M: '#4A1D8A' },
  blacklivesmatter: { D: '#1D4ED8', R: '#991B1B', M: '#6B2BD8' },
  capitol: { D: '#2563EB', R: '#B91C1C', M: '#7B2FEB' },
  climate: { D: '#3B82F6', R: '#DC2626', M: '#8B52F6' },
  covid: { D: '#60A5FA', R: '#EF4444', M: '#A875FA' },
  gun: { D: '#93C5FD', R: '#F87171', M: '#C395FD' },
  immigra: { D: '#BFDBFE', R: '#FCA5A5', M: '#DFB5FE' },
  rights: { D: '#E2EFFF', R: '#FFD5D5', M: '#F2D5FF' },
};

function BipartiteFlow({ activeTopics, startDate, endDate, onDateChange, selectedMetric }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const topicsParam = activeTopics.join(',');
        const response = await fetch(`http://localhost:8000/api/flow/bipartite_data/?start_date=${startDate?.format('YYYY-MM-DD')}&end_date=${endDate?.format('YYYY-MM-DD')}&topics=${topicsParam}`);
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        setData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching bipartite flow data:", err);
        setError("Failed to load bipartite flow data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTopics, startDate, endDate]);

  // Filter data based on startDate and endDate
  const filteredData = data.filter(item => {
    const itemDate = dayjs(item.date);
    return itemDate.isSameOrAfter(startDate) && itemDate.isSameOrBefore(endDate);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading bipartite flow data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center gap-0">
      <div className="w-full h-[18%] flex justify-start" style={{ paddingLeft: '-50px' }}>
        <AccountabilityLineChart startDate={startDate} endDate={endDate} />
      </div>
      <div className="w-full h-[36%]">
        <StackedAreaChart 
          data={filteredData} 
          activeTopics={activeTopics} 
          colorMap={colorMap} 
          inverted={false}
          selectedMetric={selectedMetric}
        />
      </div>
      <div className="w-full h-[4%]">
        <TimelineSlider 
          startDate={startDate}
          endDate={endDate}
          onDateChange={onDateChange}
        />
      </div>
      <div className="w-full h-[36%]">
        <StackedAreaChart 
          data={filteredData} 
          activeTopics={activeTopics} 
          colorMap={colorMap} 
          inverted={true}
          selectedMetric={selectedMetric}
        />
      </div>
    </div>
  );
}

BipartiteFlow.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  onDateChange: PropTypes.func.isRequired,
  selectedMetric: PropTypes.string.isRequired
};

export default BipartiteFlow;
