import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import PropTypes from 'prop-types';
import { colorMap } from './BipartiteFlow'; // Import colorMap from BipartiteFlow
import { IoIosArrowUp, IoIosArrowDown } from 'react-icons/io'; // Use different icons from react-icons
import { FaToggleOn, FaToggleOff, FaQuestionCircle } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

// Import icons for each topic
import { FaHospitalUser, FaFistRaised, FaLandmark, FaLeaf, FaVirus, FaPlane, FaBalanceScale, FaShieldAlt } from 'react-icons/fa';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

function AccountabilityLineChart({ startDate, endDate }) {
  const [chartData, setChartData] = useState({});
  const [filteredData, setFilteredData] = useState({});
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [showMisinformation, setShowMisinformation] = useState(true);
  const topics = Object.keys(colorMap);

  const topicIcons = {
    Abortion: <FaHospitalUser />,
    Blacklivesmatter: <FaFistRaised />,
    Capitol: <FaLandmark />,
    Climate: <FaLeaf />,
    Covid: <FaVirus />,
    Gun: <FaShieldAlt />,
    Immigra: <FaPlane />,
    Rights: <FaBalanceScale />
  };

  useEffect(() => {
    fetch('/data/defaultAccountability.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        const transformedData = transformData(data);
        setChartData(transformedData);
      })
      .catch(console.error);
  }, [showMisinformation]);

  useEffect(() => {
    if (startDate && endDate) {
      const newFilteredData = {};
      for (const topic in chartData) {
        newFilteredData[topic] = chartData[topic].filter(entry => {
          const entryDate = dayjs(entry.date);
          return entryDate.isSameOrAfter(startDate) && entryDate.isSameOrBefore(endDate);
        });
      }
      setFilteredData(newFilteredData);
    }
  }, [startDate, endDate, chartData]);

  const transformData = (rawData) => {
    const topicSeries = {};
  
    for (const [date, parties] of Object.entries(rawData)) {
      for (const party of ['Democratic', 'Republican']) {
        const topics = parties[party] || {};
        for (const [topic, values] of Object.entries(topics)) {
          if (!topicSeries[topic]) topicSeries[topic] = {};
          if (!topicSeries[topic][date]) topicSeries[topic][date] = { date };
  
          if (showMisinformation) {
            topicSeries[topic][date][party] = values.avg_misinfo;
          } else {
            // Apply transformations to civility values
            if (party === 'Democratic') {
              topicSeries[topic][date][party] = 1 - values.avg_civility; // Flip civility values
            } else if (party === 'Republican') {
              topicSeries[topic][date][party] = values.avg_civility - 1; // Subtract 1 from civility values
            }
          }
        }
      }
    }
  
    const transformed = {};
    for (const [topic, dateMap] of Object.entries(topicSeries)) {
      transformed[topic] = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    }
  
    return transformed;
  };  

  const applyOffset = (data, offset) => {
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

  const currentTopic = topics[currentTopicIndex];

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
          <span className="my-2 text-center">{topicIcons[currentTopic.charAt(0).toUpperCase() + currentTopic.slice(1)]}</span>
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
        {filteredData[currentTopic] && (
          <div style={{ marginRight: 20, marginLeft: -70, marginTop: 30}}>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={applyOffset(filteredData[currentTopic], 0.1)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
                <YAxis axisLine={false} tickLine={false} tick={false} domain={[-1, 1]} />
                <Tooltip content={({ label }) => <span>{label}</span>} />
                <Line
                  type="monotone"
                  dataKey="Democratic"
                  stroke={colorMap[currentTopic]?.D ?? '#3b82f6'}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Republican"
                  stroke={colorMap[currentTopic]?.R ?? '#ef4444'}
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
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired
};

export default AccountabilityLineChart; 