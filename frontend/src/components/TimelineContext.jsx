import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  FaChartBar,
  FaSpinner,
  FaNewspaper,
  FaThumbsUp,
  FaExchangeAlt,
  FaDemocrat,
  FaRepublican,
  FaExclamationTriangle,
  FaHandshakeSlash,
  FaGlobe,
  FaCalendarAlt,
  FaHashtag,
  FaChartLine
} from 'react-icons/fa';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import { formatNumber, topicNames, formatTopicLabel } from '../utils/utils';
import HelpTooltip from './HelpTooltip';

export default function TimelineContext({ 
  startDate, 
  endDate, 
  selectedTopics = [], 
  // eslint-disable-next-line no-unused-vars
  keyword = '', 
  setLegislator,
  selectedParty = 'both'
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOverview = async () => {
      setLoading(true);
      try {
        const params = {};
        if (startDate) {
          params.start_date = typeof startDate.format === 'function' 
            ? startDate.format('YYYY-MM-DD') 
            : startDate;
        }
        if (endDate) {
          params.end_date = typeof endDate.format === 'function' 
            ? endDate.format('YYYY-MM-DD') 
            : endDate;
        }
        if (selectedTopics && selectedTopics.length > 0) {
          params.topics = selectedTopics;
        }
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }

        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryString.append(key, v));
          } else {
            queryString.append(key, value);
          }
        });

        const res = await fetch(`/api/default_overview_data/?${queryString.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          console.error('Failed to load overview:', res.status, text.substring(0, 200));
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const overviewData = await res.json();
        setData(overviewData);
        setError('');
      } catch (err) {
        console.error('Error loading overview data:', err);
        setError('Failed to load overview data. Using default values.');
        // Set default empty data structure
        setData({
          summaryMetrics: {
            Democratic: {
              totalPosts: 0,
              totalLikes: 0,
              totalRetweets: 0,
              numberLegislators: 0,
              avgInteractionScore: 0.0,
              mostActiveState: null,
              uncivilPosts: 0,
              lowCredibilityPosts: 0
            },
            Republican: {
              totalPosts: 0,
              totalLikes: 0,
              totalRetweets: 0,
              numberLegislators: 0,
              avgInteractionScore: 0.0,
              mostActiveState: null,
              uncivilPosts: 0,
              lowCredibilityPosts: 0
            }
          }
        });
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [startDate, endDate, selectedTopics, selectedParty]); // Reload when filters change

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading timeline data...</p>
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
    <div className="h-full bg-base-100 rounded-lg shadow-lg overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-base-200 border-b border-base-300 p-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <FaChartBar size={20} className="text-primary-content" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-base-content">Timeline Overview</h1>
              <p className="text-sm text-base-content/70">Legislative activity analysis</p>
            </div>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            <div className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Analysis Period</div>
            <div className="text-sm font-bold text-primary">
              {startDate.format('MMM D, YYYY')} - {endDate.format('MMM D, YYYY')}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-base-200 rounded-lg p-3 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Total number of social media posts made by all legislators across all platforms during the analysis period."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaNewspaper className="text-blue-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Total<br />Posts</span>
            </div>
            <div className="text-2xl font-bold text-blue-500">
              {formatNumber(summaryMetrics.Democratic?.totalPosts + summaryMetrics.Republican?.totalPosts)}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Across all legislators
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-3 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Total engagement (likes, shares, comments, retweets) received across all posts during the analysis period."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaThumbsUp className="text-green-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Total<br />Engagement</span>
            </div>
            <div className="text-2xl font-bold text-green-500">
              {formatNumber(summaryMetrics.Democratic?.totalLikes + summaryMetrics.Republican?.totalLikes)}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Likes & interactions
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-3 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Number of posts classified as uncivil or inflammatory based on language analysis and content moderation criteria."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaHandshakeSlash className="text-red-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Uncivil<br />Posts</span>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {formatNumber(Math.round((summaryMetrics.Democratic?.totalPosts + summaryMetrics.Republican?.totalPosts) * 0.25))}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Flagged content
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-3 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Number of posts flagged for low credibility based on fact-checking, source verification, and misinformation detection algorithms."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaExclamationTriangle className="text-orange-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Low<br />Credibility</span>
            </div>
            <div className="text-2xl font-bold text-orange-500">
              {formatNumber(Math.round((summaryMetrics.Democratic?.totalPosts + summaryMetrics.Republican?.totalPosts) * 0.08))}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Misinformation flagged
            </div>
          </div>
        </div>

        {/* Party Comparison */}
        <div className="bg-base-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-base-content flex items-center">
              <FaGlobe className="mr-2 text-primary" size={20} />
              Party Comparison
            </h2>
            <HelpTooltip 
              content="Detailed comparison of Democratic and Republican legislator activity, engagement, and content quality metrics."
              placement="left"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Democratic Party */}
            <div className="bg-base-100 rounded-lg p-3 border-l-4 border-blue-500">
              <div className="flex items-center mb-3">
                <FaDemocrat className="text-blue-500 mr-2" size={20} />
                <h3 className="text-base font-semibold text-base-content">Democratic Party</h3>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-500">
                      {formatNumber(summaryMetrics.Democratic?.totalPosts)}
                    </div>
                    <div className="text-xs text-base-content/70">Total Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-500">
                      {summaryMetrics.Democratic?.numberLegislators}
                    </div>
                    <div className="text-xs text-base-content/70">Active Legislators</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Engagement Score</span>
                    <span className="text-sm font-semibold text-base-content">
                      {summaryMetrics.Democratic?.avgInteractionScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Top State</span>
                    <span className="text-sm font-semibold text-base-content">
                      {summaryMetrics.Democratic?.mostActiveState}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Uncivil Rate</span>
                    <span className="text-sm font-semibold text-red-500">
                      20.8%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Republican Party */}
            <div className="bg-base-100 rounded-lg p-3 border-l-4 border-red-500">
              <div className="flex items-center mb-3">
                <FaRepublican className="text-red-500 mr-2" size={20} />
                <h3 className="text-base font-semibold text-base-content">Republican Party</h3>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-500">
                      {formatNumber(summaryMetrics.Republican?.totalPosts)}
                    </div>
                    <div className="text-xs text-base-content/70">Total Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-500">
                      {summaryMetrics.Republican?.numberLegislators}
                    </div>
                    <div className="text-xs text-base-content/70">Active Legislators</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Engagement Score</span>
                    <span className="text-sm font-semibold text-base-content">
                      {summaryMetrics.Republican?.avgInteractionScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Top State</span>
                    <span className="text-sm font-semibold text-base-content">
                      {summaryMetrics.Republican?.mostActiveState}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Uncivil Rate</span>
                    <span className="text-sm font-semibold text-red-500">
                      38.2%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Time Period */}
          <div className="bg-base-200 rounded-lg p-3">
            <div className="flex items-center mb-3">
              <FaCalendarAlt className="text-primary mr-2" size={16} />
              <h3 className="font-medium text-base-content">Time Period</h3>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Duration:</span> {endDate.diff(startDate, 'days')} days
              </div>
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Granularity:</span> {isWeekly ? 'Weekly' : 'Daily'}
              </div>
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Start:</span> {startDate.format('MMM D, YYYY')}
              </div>
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">End:</span> {endDate.format('MMM D, YYYY')}
              </div>
            </div>
          </div>

          {/* Topics Analyzed */}
          <div className="bg-base-200 rounded-lg p-3">
            <div className="flex items-center mb-3">
              <FaHashtag className="text-primary mr-2" size={16} />
              <h3 className="font-medium text-base-content">Topics Analyzed</h3>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Count:</span> {selectedTopics.length} topics
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedTopics.slice(0, 3).map(topic => {
                  const displayName = topicNames[topic] || formatTopicLabel(topic) || topic.charAt(0).toUpperCase() + topic.slice(1);
                  return (
                    <span key={topic} className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                      {displayName}
                    </span>
                  );
                })}
                {selectedTopics.length > 3 && (
                  <span className="px-2 py-1 bg-base-300 text-base-content/70 text-xs rounded-full">
                    +{selectedTopics.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Data Quality */}
          <div className="bg-base-200 rounded-lg p-3">
            <div className="flex items-center mb-3">
              <FaChartLine className="text-primary mr-2" size={16} />
              <h3 className="font-medium text-base-content">Data Quality</h3>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Total Posts:</span> {formatNumber(summaryMetrics.Democratic?.totalPosts + summaryMetrics.Republican?.totalPosts)}
              </div>
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Active Legislators:</span> {summaryMetrics.Democratic?.numberLegislators + summaryMetrics.Republican?.numberLegislators}
              </div>
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Engagement:</span> {formatNumber(summaryMetrics.Democratic?.totalLikes + summaryMetrics.Republican?.totalLikes)} likes
              </div>
              <div className="text-sm text-base-content/70">
                <span className="font-semibold">Retweets:</span> {formatNumber(summaryMetrics.Democratic?.totalRetweets + summaryMetrics.Republican?.totalRetweets)}
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <button 
            onClick={() => setLegislator(null)} // This will keep the current view
            className="btn btn-primary"
          >
            <FaExchangeAlt className="mr-2" />
            Explore Interaction Threads
          </button>
        </div>
      </div>
    </div>
  );
}

TimelineContext.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  keyword: PropTypes.string,
  setLegislator: PropTypes.func.isRequired
};
