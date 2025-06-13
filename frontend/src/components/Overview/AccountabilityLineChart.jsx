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
} from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { topicIcons, colorMap } from '../../utils/utils';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const TOPICS = [...Object.keys(topicIcons)];
const OFFSET = 0.1;

function processChartData(rawData, { start, end, topic }) {
  return Object.entries(rawData)
    .filter(([date]) => {
      const d = dayjs(date);
      return d.isValid() && d.isSameOrAfter(start) && d.isSameOrBefore(end);
    })
    .map(([date, parties]) => {
      const demMisinfoBase = parties.Democratic[topic]?.avg_misinfo ?? 0;
      const repMisinfoBase = parties.Republican[topic]?.avg_misinfo ?? 0;
      const demCivilityBase = parties.Democratic[topic]?.avg_civility ?? 0;
      const repCivilityBase = parties.Republican[topic]?.avg_civility ?? 0;

      return {
        date,
        dem_misinfo_val: demMisinfoBase + OFFSET,
        rep_misinfo_val: repMisinfoBase - OFFSET,
        dem_incivility_val: (1 - demCivilityBase) + OFFSET,
        rep_incivility_val: -(1 - repCivilityBase) - OFFSET,
      };
    });
}

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

const InfoTooltip = () => (
  <div className="text-base-content p-4 w-72 text-sm">
    <ul className="list-disc list-inside">
      <li>Values further from the center represent higher average misinformation/incivility for each party.</li>
      <li>Check the “Info” link at the top of the page for details and definitions.</li>
    </ul>
  </div>
);

export default function AccountabilityLineChart({ startDate, endDate }) {
  const [rawData, setRawData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topicIndex, setTopicIndex] = useState(0);

  const topic = TOPICS[topicIndex];
  const Icon = topicIcons[topic];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/flow/accountability_data/');
        if (!res.ok) throw new Error('Failed to fetch accountability data');
        const data = await res.json();
        setRawData(data);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load accountability data. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  const processedData = useMemo(
    () => {
      return processChartData(rawData, {
        start: dayjs(startDate),
        end: dayjs(endDate),
        topic,
      });
    },
    [rawData, startDate, endDate, topic]
  );

  // Moved yAxisDomain useMemo call before conditional returns
  const yAxisDomain = useMemo(() => [-1 - OFFSET - 0.1, 1 + OFFSET + 0.1], []);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

  const prevTopic = () =>
    setTopicIndex(i => (i > 0 ? i - 1 : TOPICS.length - 1));
  const nextTopic = () =>
    setTopicIndex(i => (i < TOPICS.length - 1 ? i + 1 : 0));

  const renderChartContent = (dataKeyDem, dataKeyRep) => (
    <LineChart data={processedData}>
      {/* <CartesianGrid stroke="#444444" vertical={false} /> */} {/* Example if you want only horizontal lines */}
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
      <YAxis axisLine={false} tickLine={false} tick={false} domain={yAxisDomain} />
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
    <div className="flex w-full h-full items-stretch px-1 py-2">
      <div className="flex flex-col items-center w-12 z-10 mr-3 shrink-0">
        <button onClick={prevTopic} aria-label="Previous Topic">
          <IoIosArrowUp size={20} />
        </button>
        <Tippy
          content={<span className="text-sm">{topic}</span>}
          animation="scale-subtle"
          placement="right"
          arrow
        >
          <div className="my-2 text-center h-6 w-6 flex items-center justify-center">
            {Icon && <Icon size={24} />}
          </div>
        </Tippy>
        <button onClick={nextTopic} aria-label="Next Topic">
          <IoIosArrowDown size={20} />
        </button>
        <div className="mt-auto pt-2">
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

      <div className="flex-1 flex flex-col space-y-3">
        <div className="flex-1 flex flex-col min-h-0" style={{ marginLeft: -60 }}>
          <h3 className="text-center text-xs font-semibold mb-1 text-base-content/80">MISINFORMATION</h3>
          <div className="flex-1 min-h-0">
            {processedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {renderChartContent("dem_misinfo_val", "rep_misinfo_val")}
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-base-content/50">No data</div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0" style={{ marginLeft: -60 }}>
          <h3 className="text-center text-xs font-semibold mb-1 text-base-content/80">INCIVILITY</h3>
          <div className="flex-1 min-h-0">
            {processedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {renderChartContent("dem_incivility_val", "rep_incivility_val")}
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-base-content/50">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

AccountabilityLineChart.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
};