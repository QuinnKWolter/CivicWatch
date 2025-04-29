import React, { useEffect, useState } from 'react';
import StackedAreaChart from './StackedAreaChart';
import AccountabilityLineChart from './AccountabilityLineChart';
import TimelineSlider from './TimelineSlider';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { FaSpinner } from 'react-icons/fa';
import { colorMap } from '../../utils/utils';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

function BipartiteFlow({ activeTopics, startDate, endDate, onDateChange, selectedMetric }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/flow/bipartite_data/`);
        
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
  }, []);

  // Calculate total content for each topic
  const topicTotals = activeTopics.map(topic => {
    return {
      topic,
      total: data.reduce((sum, item) => {
        const valueD = item[topic]?.D?.[selectedMetric] || 0;
        const valueR = item[topic]?.R?.[selectedMetric] || 0;
        return sum + valueD + valueR;
      }, 0)
    };
  });

  // Sort topics by total content from lowest to highest
  const sortedTopics = topicTotals.sort((a, b) => a.total - b.total).map(item => item.topic);

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
          activeTopics={sortedTopics} 
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
          activeTopics={sortedTopics} 
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
