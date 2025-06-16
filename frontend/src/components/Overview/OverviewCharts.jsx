import { useState, useEffect } from 'react';
import {
  FaChartBar,
  FaChartLine,
  FaSpinner,
  FaNewspaper,
  FaThumbsUp,
  FaRetweet,
  FaExchangeAlt, // Used for new section title
  FaDemocrat,
  FaRepublican,
  FaUserFriends,
  FaExclamationTriangle,
  FaHandshakeSlash,
  FaMapMarkerAlt,
  FaBalanceScale
} from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import TrendLineChart from './TrendLineChart';
import AccountabilityLineChart from './AccountabilityLineChart';
import { colorMap, formatNumber } from '../../utils/utils';
import { ChordDiagram } from "../Interactions/ChordDiagram";
import useMeasure from "react-use-measure";
import SectionTitle from '../SectionTitle';

const DEFAULT_START = '2020-01-01';
const DEFAULT_END = '2021-12-31';
const DEFAULT_TOPICS = Object.keys(colorMap);

export default function OverviewCharts({ startDate, endDate, selectedTopics = [], keyword = '', legislator = null, geojson, setLegislator }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ref, bounds] = useMeasure(); // ref and bounds are for ChordDiagram

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const isDefault =
          startDate.format('YYYY-MM-DD') === DEFAULT_START &&
          endDate.format('YYYY-MM-DD') === DEFAULT_END &&
          selectedTopics.length === DEFAULT_TOPICS.length &&
          selectedTopics.every(t => DEFAULT_TOPICS.includes(t)) &&
          !keyword &&
          !legislator;
        
        const url = isDefault
          ? '/api/default_overview_data/'
          : `/api/overview_metrics/?start_date=${startDate.format('YYYY-MM-DD')}` +
            `&end_date=${endDate.format('YYYY-MM-DD')}` +
            `&topics=${selectedTopics.join(',')}` +
            (keyword ? `&keyword=${encodeURIComponent(keyword)}` : '') +
            (legislator ? `&legislator=${encodeURIComponent(legislator.name)}` : '');

        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Network response was not ok');

        setData(await resp.json());
        setError('');
      } catch {
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [startDate, endDate, selectedTopics, keyword, legislator]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summaryMetrics } = data;
  const isWeekly = endDate.diff(startDate, 'days') > 365;

  return (
    <div className="flex flex-col space-y-4 p-2">
      <SectionTitle icon={<FaChartBar />} text="Summary Metrics" helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>This section displays key metrics for selected Democratic and Republican legislators.</li>
            <li>Metrics include total posts, active legislators, likes, retweets, and more.</li>
            <li>Additional metrics track uncivil posts and low-credibility content per party.</li>
          </ul>
        </div>
      } />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(summaryMetrics).map(([party, m]) => (
          <MetricsCard key={party} party={party} metrics={m} />
        ))}
      </div>

      <SectionTitle icon={<FaExchangeAlt />} text="Legislator Interactions" helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>Click on a Legislator Edge to go to their page </li>
             <li> Click on map to view out-of-state interactions </li>
              <li> Out-of-state highlighted in yellow</li>
          </ul>
        </div>
      } />
      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
          <div className="h-96" ref={ref}> 
            {bounds.width > 0 && bounds.height > 0 && ( // Ensure bounds are measured before rendering ChordDiagram
              <ChordDiagram
                width={bounds.width}
                height={bounds.height}
                startDate={startDate}
                endDate={endDate}
                legislator={legislator}
                geojson={geojson}
                setLegislator={setLegislator}
              />
            )}
          </div>
        </div>
      </div>

      <SectionTitle icon={<FaBalanceScale />} text="Accountability" helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>These charts track accountability metrics over time for both parties.</li>
            <li>The top chart shows low-credibility content trends.</li>
            <li>The bottom chart displays uncivil communication patterns.</li>
            <li>Use the switch in the upper left to cycle through topics.</li>
          </ul>
        </div>
      } />
      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
          <div className="h-80">
            <AccountabilityLineChart startDate={startDate} endDate={endDate} />
          </div>
        </div>
      </div>

      <SectionTitle icon={<FaChartLine />} text={`Engagement Trends Over Time ${isWeekly ? '(Weekly)' : '(Daily)'}`} helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>This chart shows engagement trends over the selected time period.</li>
            <li>Data is aggregated by {isWeekly ? 'week' : 'day'} for better visualization.</li>
            <li>Engagement score combines likes and retweets normalized by post count.</li>
          </ul>
        </div>
      } />
      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
          <div className="h-80">
            <TrendLineChart startDate={startDate} endDate={endDate} selectedTopics={selectedTopics} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricsCard({ party, metrics }) {
  const isDem = party === 'Democratic';
  const iconProps = isDem
    ? { icon: <FaDemocrat className="text-blue-500 mr-1" />, label: 'Democrats' }
    : { icon: <FaRepublican className="text-red-500 mr-1" />, label: 'Republicans' };

  return (
    <div className="card shadow-md">
      <div className="card-body p-2">
        <h3 className="card-title text-lg flex items-center">
          {iconProps.icon}
          {iconProps.label}
        </h3>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Stat icon={<FaNewspaper className="text-primary" />} label="Posts" value={formatNumber(metrics.totalPosts)} />
          <Stat icon={<FaUserFriends className="text-primary" />} label="Legislators" value={metrics.numberLegislators} />
          <Stat icon={<FaThumbsUp className="text-primary" />} label="Likes" value={formatNumber(metrics.totalLikes)} />
          <Stat icon={<FaRetweet className="text-primary" />} label="Retweets" value={formatNumber(metrics.totalRetweets)} />
          <Stat icon={<FaMapMarkerAlt className="text-primary" />} label="Top State" value={metrics.mostActiveState} />
          <Stat icon={<FaExchangeAlt className="text-primary" />} label="Avg Interaction" value={metrics.avgInteractionScore.toFixed(2)} />
          <Stat icon={<FaHandshakeSlash className="text-error" />} label="Uncivil Posts" value={formatNumber(metrics.numUncivilPosts)} />
          <Stat icon={<FaExclamationTriangle className="text-error" />} label="Misinfo Posts" value={formatNumber(metrics.numMisinfoPosts)} />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <Tippy content={label} animation="scale-subtle" arrow>
      <div className="stat bg-base-100 rounded-box p-2 flex items-center">
        <div className="text-xl mr-2">{icon}</div>
        <div>
          <div className="stat-value text-base font-bold">{value}</div>
          <div className="stat-desc text-xs font-semibold uppercase">{label}</div>
        </div>
      </div>
    </Tippy>
  );
}