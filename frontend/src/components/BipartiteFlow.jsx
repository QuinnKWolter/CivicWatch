import React, { useEffect, useState } from 'react';
import StackedAreaChart from './StackedAreaChart';
import AccountabilityLineChart from './AccountabilityLineChart';
import TimelineSlider from './TimelineSlider';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

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

function BipartiteFlow({ activeTopics, startDate, endDate, onDateChange }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/data/defaultBipartite.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => setData(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const filteredData = data.filter(item => {
        const itemDate = dayjs(item.date);
        return itemDate.isSameOrAfter(startDate) && itemDate.isSameOrBefore(endDate);
      });
      setData(filteredData);
    }
  }, [startDate, endDate]);

  return (
    <div className="relative w-full h-full flex flex-col items-center gap-0">
      <div className="w-full h-[18%] flex justify-start" style={{ paddingLeft: '-50px' }}>
        <AccountabilityLineChart startDate={startDate} endDate={endDate} />
      </div>
      <div className="w-full h-[36%]">
        <StackedAreaChart 
          data={data} 
          activeTopics={activeTopics} 
          colorMap={colorMap} 
          inverted={false}
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
  endDate: PropTypes.object,
  onDateChange: PropTypes.func.isRequired
};

export default BipartiteFlow;
