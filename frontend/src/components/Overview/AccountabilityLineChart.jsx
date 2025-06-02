import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  IoIosArrowUp,
  IoIosArrowDown
} from 'react-icons/io';
import {
  FaQuestionCircle,
  FaSpinner
} from 'react-icons/fa'; // Removed FaToggleOn, FaToggleOff
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { topicIcons, colorMap } from '../../utils/utils';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// === Constants ===
const TOPICS = ['all', ...Object.keys(topicIcons)];
// const OFFSET = 0.1; // No longer explicitly used for Dem/Rep separation in this new structure

// === Helpers ===
function processChartData(rawData, { start, end, topic }) {
  return Object.entries(rawData)
    .filter(([date]) => {
      const d = dayjs(date);
      return d.isValid() && d.isSameOrAfter(start) && d.isSameOrBefore(end);
    })
    .map(([date, parties]) => {
      const demMisinfo = parties.Democratic[topic]?.avg_misinfo ?? 0;
      const repMisinfo = parties.Republican[topic]?.avg_misinfo ?? 0;
      const demCivility = parties.Democratic[topic]?.avg_civility ?? 0; // Lower is less civil
      const repCivility = parties.Republican[topic]?.avg_civility ?? 0; // Lower is less civil

      return {
        date,
        // Misinformation: Higher is worse. Dem positive, Rep negative.
        dem_misinfo_val: demMisinfo,
        rep_misinfo_val: -repMisinfo,
        // Incivility: Higher is worse (1 - civility). Dem positive, Rep negative.
        dem_incivility_val: 1 - demCivility,
        rep_incivility_val: -(1 - repCivility),
      };
    });
}

// === Subcomponents ===
const Loading = () => (
  <div className="flex flex-col items-center justify-center h-full w-full">
    <FaSpinner className="animate-spin text-3xl text-primary mb-2" />
    <p className="text-sm">Loading accountability data...</p>
  </div>
);

const ErrorBanner = ({ message }) => (
  <div className="alert alert-error shadow-sm text-sm p-2">
    <span>{message}</span>
  </div>
);

// Updated InfoTooltip to match provided styling (if it was different)
const InfoTooltip = () => (
  <div className="text-base-content p-4 w-72 text-sm"> {/* Ensure this matches your intended style */}
    <ul className="list-disc list-inside">
      <li>Values further from the center represent higher average misinformation/incivility for each party.</li>
      <li>Check the “Info” link at the top of the page for details and definitions.</li>
    </ul>
  </div>
);

// === Main Component ===
export default function AccountabilityLineChart({ startDate, endDate }) {
  const [rawData, setRawData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topicIndex, setTopicIndex] = useState(0);
  // Removed showMisinfo state

  const topic = TOPICS[topicIndex];
  const Icon = topicIcons[topic];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/flow/accountability_data/');
        if (!res.ok) throw new Error('Failed to fetch accountability data');
        setRawData(await res.json());
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load accountability data. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const processedData = useMemo(
    () =>
      processChartData(rawData, {
        start: dayjs(startDate),
        end: dayjs(endDate),
        topic,
      }),
    [rawData, startDate, endDate, topic]
  );

  const prevTopic = () =>
    setTopicIndex(i => (i > 0 ? i - 1 : TOPICS.length - 1));
  const nextTopic = () =>
    setTopicIndex(i => (i < TOPICS.length - 1 ? i + 1 : 0));

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

  const renderChartContent = (dataKeyDem, dataKeyRep) => (
    <LineChart data={processedData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
      <YAxis axisLine={false} tickLine={false} tick={false} domain={[-1, 1]} />
      <Tooltip content={({ label }) => <span className="text-xs">{label}</span>} />
      <Line
        type="monotone"
        dataKey={dataKeyDem}
        stroke={topic === 'all' ? '#3b82f6' : colorMap[topic]?.D || '#3b82f6'}
        strokeWidth={2}
        dot={false}
        name="Democratic"
      />
      <Line
        type="monotone"
        dataKey={dataKeyRep}
        stroke={topic === 'all' ? '#ef4444' : colorMap[topic]?.R || '#ef4444'}
        strokeWidth={2}
        dot={false}
        name="Republican"
      />
    </LineChart>
  );

  return (
    <div className="flex w-full h-full items-stretch px-1 py-2"> {/* items-stretch for equal height columns */}
      {/* Left Column: Topic Selector + Info Tooltip */}
      <div className="flex flex-col items-center w-12 z-10 mr-3 shrink-0"> {/* shrink-0 to prevent shrinking */}
        <button onClick={prevTopic} aria-label="Previous Topic">
          <IoIosArrowUp size={20} />
        </button>
        <Tippy
          content={<span className="text-sm">{topic}</span>}
          animation="scale-subtle"
          placement="right"
          arrow
        >
          <div className="my-2 text-center h-6 w-6"> {/* Ensure icon div has a size */}
            {Icon && <Icon size={24} />}
          </div>
        </Tippy>
        <button onClick={nextTopic} aria-label="Next Topic">
          <IoIosArrowDown size={20} />
        </button>
        <div className="mt-auto pt-2"> {/* Pushes Info icon to bottom of this column section, pt-2 for spacing */}
          <Tippy
            content={<InfoTooltip />}
            animation="scale-subtle"
            placement="right"
            arrow
          >
            <span className="cursor-pointer inline-block align-middle">
              <FaQuestionCircle size={18} />
            </span>
          </Tippy>
        </div>
      </div>

      {/* Right Column: Charts Area */}
      <div className="flex-1 flex flex-col space-y-3">
        {/* Misinformation Chart */}
        <div className="flex flex-col min-h-0"> {/* min-h-0 for flex children in ResponsiveContainer */}
          <h3 className="text-center text-xs font-semibold mb-1 text-base-content/80">MISINFORMATION</h3>
          {processedData.length > 0 ? (
            <div style={{ width: '100%', marginLeft: -60 }} className="flex-grow"> {/* Adjusted marginLeft, flex-grow */}
              <ResponsiveContainer width="100%" height="100%">
                {renderChartContent("dem_misinfo_val", "rep_misinfo_val")}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-xs text-base-content/50">No data</div>
          )}
        </div>

        {/* Incivility Chart */}
        <div className="flex flex-col min-h-0"> {/* min-h-0 for flex children in ResponsiveContainer */}
          <h3 className="text-center text-xs font-semibold mb-1 text-base-content/80">INCIVILITY</h3>
          {processedData.length > 0 ? (
            <div style={{ width: '100%', marginLeft: -60 }} className="flex-grow"> {/* Adjusted marginLeft, flex-grow */}
              <ResponsiveContainer width="100%" height="100%">
                {renderChartContent("dem_incivility_val", "rep_incivility_val")}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-xs text-base-content/50">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}

AccountabilityLineChart.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
};