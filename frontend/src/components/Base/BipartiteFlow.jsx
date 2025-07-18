import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { FaSpinner, FaLayerGroup } from 'react-icons/fa';
import StackedAreaChart from './StackedAreaChart';
import TimelineSlider from './TimelineSlider';
import SectionTitle from '../SectionTitle';
import { colorMap } from '../../utils/utils';

// Extend dayjs with comparison plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Loading indicator
const Loading = () => (
  <div className="flex flex-col items-center justify-center h-full">
    <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
    <p className="text-lg">Loading bipartite flow data...</p>
  </div>
);

// Error banner
const ErrorBanner = ({ message }) => (
  <div className="alert alert-error shadow-lg">
    <div className="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="ml-2">{message}</span>
    </div>
  </div>
);

export default function BipartiteFlow({ activeTopics, startDate, endDate, onDateChange, selectedMetric }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch data once
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/flow/bipartite_data/');
        if (!res.ok) throw new Error();
        setData(await res.json());
        setError('');
      } catch {
        console.error('Error fetching bipartite flow data');
        setError('Failed to load bipartite flow data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Sort topics by total D+R for selected metric
  const sortedTopics = useMemo(() => {
    return [...activeTopics]
      .map(topic => {
        const total = data.reduce((sum, item) => {
          const d = item[topic]?.D?.[selectedMetric] || 0;
          const r = item[topic]?.R?.[selectedMetric] || 0;
          return sum + d + r;
        }, 0);
        return { topic, total };
      })
      .sort((a, b) => a.total - b.total)
      .map(t => t.topic);
  }, [activeTopics, data, selectedMetric]);

  // Filter data by date range
  const filteredData = useMemo(
    () => data.filter(item => {
      const d = dayjs(item.date);
      return d.isSameOrAfter(dayjs(startDate)) && d.isSameOrBefore(dayjs(endDate));
    }),
    [data, startDate, endDate]
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="flex flex-col w-full h-full p-2">
      <SectionTitle
        icon={<FaLayerGroup />}
        text="Bipartisan Topic Activity Flow"
        helpContent={
          <div className="text-left">
            <ul className="list-disc list-inside space-y-1">
              <li>This visualization compares topic activity between Democrats (top) and Republicans (bottom) over time.</li>
              <li>Each colored area represents a topic&apos;s contribution to the total selected metric ({selectedMetric}).</li>
              <li>Use the timeline slider in the center to adjust the displayed date range, noting key events in the timeline.</li>
            </ul>
          </div>
        }
      />
      <div className="card shadow-md bg-base-300 flex-1 overflow-hidden">
        <div className="card-body p-2 flex flex-col items-center h-full">
            <div className="w-full" style={{ height: "45%", minHeight: "150px" }}>
              <StackedAreaChart
                data={filteredData}
                activeTopics={sortedTopics}
                colorMap={colorMap}
                inverted={false}
                selectedMetric={selectedMetric}
              />
            </div>
            <div className="w-full my-2" style={{ height: "50px" }}>
              <TimelineSlider
                startDate={startDate}
                endDate={endDate}
                onDateChange={onDateChange}
              />
            </div>
            <div className="w-full" style={{ height: "45%", minHeight: "150px" }}>
              <StackedAreaChart
                data={filteredData}
                activeTopics={sortedTopics}
                colorMap={colorMap}
                inverted
                selectedMetric={selectedMetric}
              />
            </div>
        </div>
      </div>
    </div>
  );
}

BipartiteFlow.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  onDateChange: PropTypes.func.isRequired,
  selectedMetric: PropTypes.string.isRequired,
};
