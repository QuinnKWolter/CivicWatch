import React, { useState, useEffect, useMemo, useRef } from 'react';
import OverviewCharts from '../Overview/OverviewCharts';
import EngagementCharts from '../Engagement/EngagementCharts';
import GeographyCharts from '../Geography/GeographyCharts';
import LegislatorCharts from '../Legislators/LegislatorCharts';
import AccountabilityInterface from '../Accountability/AccountabilityInterface';
import { PostCharts } from '../Posts/PostsCharts';
import InteractionNetwork from '../InteractionNetwork';
import * as topojson from 'topojson-client';
import { RiDashboardLine } from 'react-icons/ri';
import { BiTrendingUp } from 'react-icons/bi';
import { FaUsers } from 'react-icons/fa';
import { IoEarthOutline } from 'react-icons/io5';
import { BsFilePost } from 'react-icons/bs';

const SCATTER_KEYS = [
  'abortion', 'blacklivesmatter', 'capitol', 'civility_score_tw', 'climate',
  'covid', 'gun', 'immigra', 'interaction_score_tw', 'overperforming_score_tw',
  'rights', 'total_interactions_tw', 'total_likes_tw', 'total_misinfo_count_tw',
  'total_posts_tw_count', 'total_retweets_tw',
];

const tabs = [
  { icon: <RiDashboardLine />, label: 'Overview', value: 0 },
  { icon: <BiTrendingUp />, label: 'Engagement', value: 1 },
  { icon: <FaUsers />, label: 'Legislators', value: 3 },
  { icon: <IoEarthOutline />, label: 'Geography', value: 4 },
  { icon: <BsFilePost />, label: 'Posts', value: 2 },
  { icon: <FaUsers />, label: 'Interaction', value: 6 },
];

export default function TabbedCharts({
  legislatorClicked,
  postData,
  setLegislatorClicked,
  setPostData,
  startDate,
  endDate,
  selectedTopics,
  selectedMetric,
  keyword,
  legislator,
  setLegislator,
  activeTopics
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredTab, setHoveredTab] = useState(null); // Tracks hovered tab value

  const [legScatterData, setLegScatterData] = useState([]);
  const [monthlyLeg, setMonthlyLeg] = useState([]);
  const [semanticData, setSemanticData] = useState([]);
  const [geoData, setGeoData] = useState([]);
  const [geojson, setGeojson] = useState(null);

  const [loading, setLoading] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [error, setError] = useState(null);

  const hoveredSemanticDataRef = useRef(null);
  const memoTopics = useMemo(() => selectedTopics, [selectedTopics]);

  // ... (useEffect hooks remain the same) ...
  // Initial scatter data load & normalize
useEffect(() => {
    fetch('/api/legislators/scatter/')
        .then(res => res.json())
        .then(data => {
            const minMax = SCATTER_KEYS.reduce((acc, key) => {
                const nums = data.map(d => parseFloat(d[key])).filter(Number.isFinite);
                acc[key] = { min: Math.min(...nums), max: Math.max(...nums) };
                return acc;
            }, {});
            const normalized = data.map(d => {
                const out = {};
                SCATTER_KEYS.forEach(key => {
                    const v = parseFloat(d[key]);
                    const { min, max } = minMax[key];
                    out[key] = Number.isFinite(v) && max !== min ? (v - min) / (max - min) : v;
                });
                return { ...d, ...out };
            });
            setLegScatterData(normalized);
        })
        .catch(err => console.error('Error fetching scatter data:', err));
}, []);

// GeoJSON load
useEffect(() => {
    (async () => {
        try {
            const res = await fetch('/api/us-states/');
            if (!res.ok) throw new Error();
            const topo = await res.json();
            setGeojson(topojson.feature(topo, topo.objects.states));
        } catch (e) {
            console.error('GeoJSON load error:', e);
            setError('Failed to load geography data.');
        }
    })();
}, []);

// Scatter/filter, monthly, semantic effects
useEffect(() => {
    if (!startDate || !endDate) return;

    // Filter scatter by date
    const params = new URLSearchParams({
        startDate: startDate.format('DD-MM-YYYY'),
        endDate: endDate.format('DD-MM-YYYY'),
    });
    fetch(`/api/legislators/scatter/?${params}`)
        .then(res => res.json())
        .then(setLegScatterData)
        .catch(err => console.error('Error filtering scatter:', err));

    // Monthly data
    setLoading(true);
    fetch(
        `/api/legislators/legislator_posts_by_month_top_50/?` +
        new URLSearchParams({
            start_date: startDate.format('YYYY-MM-DD'),
            end_date: endDate.format('YYYY-MM-DD'),
        })
    )
        .then(res => res.json())
        .then(data => setMonthlyLeg(data))
        .catch(err => console.error('Monthly data error:', err))
        .finally(() => setLoading(false));

    // Semantic similarity
    setSemanticLoading(true);
    fetch(
        `/api/posts/post_semantic_similarity/?` +
        new URLSearchParams({
            start_date: startDate.format('YYYY-MM-DD'),
            end_date: endDate.format('YYYY-MM-DD'),
        })
    )
        .then(res => res.json())
        .then(data => setSemanticData(data))
        .catch(err => console.error('Semantic data error:', err))
        .finally(() => setSemanticLoading(false));
}, [startDate, endDate]);


  const renderContent = () => {
    switch (activeTab) {
      case 0:
        return (
          <OverviewCharts
            startDate={startDate}
            endDate={endDate}
            selectedTopics={memoTopics}
            keyword={keyword}
            legislator={legislator}
            geojson={geojson}
            setLegislator={setLegislator}
          />
        );
      case 1:
        return <EngagementCharts {...{ startDate, endDate, selectedTopics: memoTopics }} />;
      case 2:
        return (
          <PostCharts
            startDate={startDate}
            endDate={endDate}
            semanticData={semanticData}
            setSemanticData={setSemanticData}
            semanticLoading={semanticLoading}
            hoveredSemanticDataRef={hoveredSemanticDataRef}
            keyword={keyword}
            legislator={legislator}
            geojson={geojson}
            setLegislator={setLegislator}
            activeTopics={activeTopics}
          />
        );
      case 3:
        return (
          <LegislatorCharts
            {...{
              legislatorClicked,
              setLegislatorClicked,
              postData,
              setPostData,
              startDate,
              endDate,
              legScatterData,
              monthlyLeg,
              loading,
              semanticData,
              legislator,
              geojson,
              setLegislator,
              activeTopics
            }}
          />
        );
      case 4:
        return (
          <GeographyCharts
            {...{
              startDate,
              endDate,
              selectedTopics: memoTopics,
              selectedMetric,
              geoData,
              setGeoData,
              geojson,
              setGeojson,
            }}
          />
        );
      case 5: // Note: Your tabs array doesn't have a value 5, check if this case is needed or if tab values are misaligned
        return (
          <AccountabilityInterface
            {...{ startDate, endDate, selectedTopics: memoTopics }}
          />
        );
      case 6:
        return (
          <InteractionNetwork
            {...{
              startDate,
              endDate,
              selectedTopics: memoTopics,
              selectedMetric,
              legislator,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="tab-container flex overflow-x-auto">
        {tabs.map(({ icon, label, value }) => {
          const isTabActive = activeTab === value;
          const isTabHovered = hoveredTab === value;
          const showLabel = isTabActive || isTabHovered;

          return (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              onMouseEnter={() => setHoveredTab(value)}
              onMouseLeave={() => setHoveredTab(null)}
              // Added overflow-hidden to the button for cleaner child transitions
              className={`tab-btn flex items-center space-x-2 py-2 px-4 rounded-t overflow-hidden transition-all duration-300 ease-in-out ${
                isTabActive
                  ? 'bg-primary text-primary-content tab-active' // tab-active is your custom class for active state
                  : 'bg-base-300 text-base-content hover:bg-primary/20'
              }`}
            >
              {React.cloneElement(icon, { className: "flex-shrink-0" })} {/* Ensure icon doesn't shrink */}
              <span
                className={`tab-label whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out ${
                  showLabel
                    ? 'opacity-100 max-w-[150px]' // Adjust max-w-[150px] as needed for your longest label
                    : 'opacity-0 max-w-0'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 transition-opacity duration-500 ease-in-out">
        {renderContent()}
      </div>
    </div>
  );
}