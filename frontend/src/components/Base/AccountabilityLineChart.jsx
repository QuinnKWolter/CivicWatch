import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import PropTypes from 'prop-types';
import { IoIosArrowUp, IoIosArrowDown } from 'react-icons/io';
import { FaToggleOn, FaToggleOff, FaQuestionCircle, FaSpinner } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { topicIcons } from '../../utils/utils'; // Import topicIcons

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

function AccountabilityLineChart({ startDate, endDate }) {
  const [chartData, setChartData] = useState({});
  const [filteredData, setFilteredData] = useState({});
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [showMisinformation, setShowMisinformation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const topics = ['all', ...Object.keys(topicIcons)]; // Add "all" to the topics list

  const currentTopic = topics[currentTopicIndex];
  const CurrentIcon = topicIcons[currentTopic];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/flow/accountability_data/`);
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        setChartData(data);
        setFilteredData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching accountability data:", err);
        setError("Failed to load accountability data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!chartData) return;

    const filtered = Object.entries(chartData).reduce((acc, [date, parties]) => {
      const itemDate = dayjs(date);
      if (itemDate.isValid() && itemDate.isSameOrAfter(dayjs(startDate)) && itemDate.isSameOrBefore(dayjs(endDate))) {
        acc[date] = {
          Democratic: {
            ...parties.Democratic,
            value: showMisinformation 
              ? parties.Democratic[currentTopic]?.avg_misinfo 
              : 1 - parties.Democratic[currentTopic]?.avg_civility
          },
          Republican: {
            ...parties.Republican,
            value: showMisinformation 
              ? parties.Republican[currentTopic]?.avg_misinfo 
              : (parties.Republican[currentTopic]?.avg_civility ?? 0) - 1
          }
        };
      }
      return acc;
    }, {});

    setFilteredData(filtered);
  }, [chartData, startDate, endDate, showMisinformation, currentTopic]);

  const currentData = Object.entries(filteredData).map(([date, parties]) => ({
    date,
    Democratic: parties.Democratic.value,
    Republican: parties.Republican.value
  }));

  const applyOffset = (data, offset) => {
    if (!data) return [];
    return data.map(entry => ({
      ...entry,
      Democratic: entry.Democratic + offset,
      Republican: entry.Republican - offset
    }));
  };

  const handlePrevious = () => {
    setCurrentTopicIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : topics.length - 1));
  };

  const handleNext = () => {
    setCurrentTopicIndex((prevIndex) => (prevIndex < topics.length - 1 ? prevIndex + 1 : 0));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <FaSpinner className="animate-spin text-3xl text-primary mb-2" />
        <p className="text-sm">Loading accountability data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-sm text-sm p-2">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center px-1">
      <div className="flex flex-col items-center" style={{ width: '50px', zIndex: 1000 }}>
        <button onClick={handlePrevious}>
          <IoIosArrowUp size={20} />
        </button>
        <Tippy
          content={<span className="text-sm">{currentTopic}</span>}
          animation="scale-subtle"
          placement="right"
          arrow={true}
        >
          <span className="my-2 text-center">
            <CurrentIcon />
          </span>
        </Tippy>
        <button onClick={handleNext}>
          <IoIosArrowDown size={20} />
        </button>
      </div>
      <div className="flex-1 relative">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center" style={{ zIndex: 1000 }}>
          <span className="text-lg font-bold transition-all duration-300">{showMisinformation ? "Average Misinformation" : "Average Incivility"}</span>
          <button onClick={() => setShowMisinformation(!showMisinformation)} className="ml-2">
            {showMisinformation ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
          </button>
          <Tippy
            content={
              <div className="bg-base-100 text-base-content border border-primary shadow-lg rounded-box p-4 w-[300px] space-y-2">
                <ul className="text-sm list-disc list-inside">
                  <li>Values further from the center represent higher average misinformation/incivility for each party.</li>
                  <li>Check the "Info" link at the top of the page for details and definitions.</li>
                </ul>
              </div>
            }
            animation="scale-subtle"
            placement="right"
            arrow={true}
          >
            <span className="ml-2 cursor-pointer">
              <FaQuestionCircle size={20} />
            </span>
          </Tippy>
        </div>
        {currentData.length > 0 && (
          <div style={{ marginRight: 20, marginLeft: -70, marginTop: 30}}>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={applyOffset(currentData, 0.1)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
                <YAxis axisLine={false} tickLine={false} tick={false} domain={[-1, 1]} />
                <Tooltip content={({ label }) => <span>{label}</span>} />
                <Line
                  type="monotone"
                  dataKey="Democratic"
                  stroke={topicIcons[currentTopic]?.D ?? '#3b82f6'}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Republican"
                  stroke={topicIcons[currentTopic]?.R ?? '#ef4444'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

AccountabilityLineChart.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  startDate: PropTypes.object,
  endDate: PropTypes.object
};

export default AccountabilityLineChart; 