import { useState } from 'react';
import PropTypes from 'prop-types';
import { FaUser, FaArrowLeft, FaChartLine, FaUsers, FaShieldAlt, FaStar, FaGlobe, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { FaRepublican } from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { colorMap } from '../utils/utils';
import HelpTooltip from './HelpTooltip';

export default function LegislatorContext({ 
  legislator, 
  setLegislator,
  startDate,
  endDate,
  // eslint-disable-next-line no-unused-vars
  selectedTopics,
  // eslint-disable-next-line no-unused-vars
  keyword,
  // eslint-disable-next-line no-unused-vars
  activeTopics
}) {
  const [sortFilters, setSortFilters] = useState({
    date: 'desc', // desc, asc, none
    engagement: 'none',
    civility: 'none',
    credibility: 'none'
  });

  // Mock data for demonstration
  const mockData = {
    name: "Bert Stedman",
    party: "R",
    state: "AK",
    metrics: {
      totalPosts: 12656,
      totalEngagement: 89432,
      uncivilPosts: 234,
      lowCredibilityPosts: 156
    },
    breakdowns: {
      posts: { twitter: 9234, facebook: 3422 },
      engagement: { likes: 67890, shares: 21542 }
    },
    rankings: {
      state: {
        totalPosts: "Top 15%",
        totalEngagement: "Top 10%",
        uncivilPosts: "Top 5%",
        lowCredibilityPosts: "Top 8%"
      },
      party: {
        totalPosts: "Top 30%",
        totalEngagement: "Top 25%",
        uncivilPosts: "Top 3%",
        lowCredibilityPosts: "Top 12%"
      },
      overall: {
        totalPosts: "Top 20%",
        totalEngagement: "Top 15%",
        uncivilPosts: "Top 2%",
        lowCredibilityPosts: "Top 6%"
      }
    },
    topTopicsByPosts: [
      { name: "Climate", value: 35, color: colorMap.climate.color },
      { name: "Capitol", value: 28, color: colorMap.capitol.color },
      { name: "Rights", value: 22, color: colorMap.rights.color },
      { name: "Immigra", value: 15, color: colorMap.immigra.color }
    ],
    topTopicsByEngagement: [
      { name: "Capitol", value: 42, color: colorMap.capitol.color },
      { name: "Climate", value: 31, color: colorMap.climate.color },
      { name: "Gun", value: 18, color: colorMap.gun.color },
      { name: "Covid", value: 9, color: colorMap.covid.color }
    ]
  };

  const getRankingColor = (ranking, metric) => {
    // Determine if this is a positive or negative metric
    const isPositive = ['totalPosts', 'totalEngagement'].includes(metric);
    const isNegative = ['uncivilPosts', 'lowCredibilityPosts'].includes(metric);
    
    // Extract the percentage number
    const percentage = parseInt(ranking.match(/\d+/)[0]);
    
    if (isPositive) {
      // For positive metrics, higher percentage is better
      if (percentage <= 10) return "bg-green-100 text-green-800 border-green-200";
      if (percentage <= 20) return "bg-green-50 text-green-700 border-green-100";
      if (percentage <= 30) return "bg-yellow-100 text-yellow-800 border-yellow-200";
      if (percentage <= 40) return "bg-orange-100 text-orange-800 border-orange-200";
      return "bg-red-100 text-red-800 border-red-200";
    } else if (isNegative) {
      // For negative metrics, lower percentage is better (inverted scale)
      if (percentage <= 5) return "bg-red-100 text-red-800 border-red-200";
      if (percentage <= 10) return "bg-orange-100 text-orange-800 border-orange-200";
      if (percentage <= 20) return "bg-yellow-100 text-yellow-800 border-yellow-200";
      if (percentage <= 30) return "bg-green-50 text-green-700 border-green-100";
      return "bg-green-100 text-green-800 border-green-200";
    }
    
    // Fallback for unknown metrics
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleBack = () => {
    setLegislator(null);
  };

  const toggleSort = (filterKey) => {
    setSortFilters(prev => {
      const current = prev[filterKey];
      const next = current === 'none' ? 'desc' : current === 'desc' ? 'asc' : 'none';
      return { ...prev, [filterKey]: next };
    });
  };

  const getSortIcon = (filterKey) => {
    const sort = sortFilters[filterKey];
    if (sort === 'desc') return <FaSortDown className="text-primary" />;
    if (sort === 'asc') return <FaSortUp className="text-primary" />;
    return <FaSort className="text-base-content/40" />;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-base-300 border border-base-400 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-base-content">{payload[0].name}</p>
          <p className="text-base-content/70">{payload[0].value}%</p>
        </div>
      );
    }
    return null;
  };

  // Add PropTypes for CustomTooltip
  CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.number
    }))
  };

  // Use legislator prop to show actual data when available
  const displayData = legislator ? {
    name: legislator.name,
    party: legislator.party,
    state: legislator.state,
    // Add other properties as needed
  } : mockData;

  return (
    <div className="h-full bg-base-100 rounded-lg shadow-lg overflow-y-auto">
      {/* Header with Back Button */}
      <div className="sticky top-0 bg-base-200 border-b border-base-300 p-3 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 px-3 py-2 bg-base-100 hover:bg-base-300 rounded-lg transition-colors duration-200 text-base-content"
          >
            <FaArrowLeft size={16} />
            <span className="font-medium">Back to Timeline</span>
          </button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-4 space-y-4">
        {/* Profile Header */}
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
              <FaUser size={28} className="text-primary-content" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-base-content">
              {displayData.name} ({displayData.party} - {displayData.state})
            </h1>
            <p className="text-sm text-base-content/70 mt-1">
              Republican • State Senator • Alaska
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Analysis Period</div>
              <div className="text-sm font-bold text-primary">
                {startDate.format('MMM D, YYYY')} - {endDate.format('MMM D, YYYY')}
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-base-200 rounded-lg p-3 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Total number of social media posts made by the legislator across all platforms during the analysis period."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaChartLine className="text-blue-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Total<br />Posts</span>
            </div>
            <div className="text-xl font-bold text-blue-500">
              {formatNumber(mockData.metrics.totalPosts)}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              {formatNumber(mockData.breakdowns.posts.twitter)} Twitter<br />{formatNumber(mockData.breakdowns.posts.facebook)} Facebook
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Total engagement (likes, shares, comments, retweets) received across all posts during the analysis period."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaUsers className="text-green-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Total<br />Engagement</span>
            </div>
            <div className="text-xl font-bold text-green-500">
              {formatNumber(mockData.metrics.totalEngagement)}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              {formatNumber(mockData.breakdowns.engagement.likes)} Likes<br />{formatNumber(mockData.breakdowns.engagement.shares)} Shares
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Number of posts classified as uncivil or inflammatory based on language analysis and content moderation criteria."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaShieldAlt className="text-red-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Uncivil<br />Posts</span>
            </div>
            <div className="text-xl font-bold text-red-500">
              {mockData.metrics.uncivilPosts}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Uncivil Posts
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 text-center relative">
            <div className="absolute top-2 right-2">
              <HelpTooltip 
                content="Number of posts flagged for low credibility based on fact-checking, source verification, and misinformation detection algorithms."
                placement="left"
              />
            </div>
            <div className="flex items-center justify-center mb-2">
              <FaStar className="text-orange-500 mr-2" size={20} />
              <span className="font-semibold text-sm">Low<br />Credibility</span>
            </div>
            <div className="text-xl font-bold text-orange-500">
              {mockData.metrics.lowCredibilityPosts}
            </div>
            <div className="text-xs text-base-content/60 mt-1">
              Low Credibility Posts
            </div>
          </div>
        </div>

        {/* Rankings Section */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* State Rankings */}
            <div className="bg-base-200 rounded-lg p-3 relative">
              <div className="absolute top-2 right-2">
                <HelpTooltip 
                  content="Performance rankings compared to other legislators from the same state. Percentiles show where this legislator stands among their state peers."
                  placement="left"
                />
              </div>
              <h3 className="font-medium text-base-content mb-3 flex items-center">
                <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold mr-2">AK</span>
                State Rankings
              </h3>
              <div className="space-y-2">
                {Object.entries(mockData.rankings.state).map(([metric, ranking]) => (
                  <div key={metric} className="flex items-center justify-between">
                    <span className="text-sm text-base-content/70 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getRankingColor(ranking, metric)}`}>
                      {ranking}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Party Rankings */}
            <div className="bg-base-200 rounded-lg p-3 relative">
              <div className="absolute top-2 right-2">
                <HelpTooltip 
                  content="Performance rankings compared to other legislators from the same political party. Shows how this legislator performs within their party."
                  placement="left"
                />
              </div>
              <h3 className="font-medium text-base-content mb-3 flex items-center">
                <FaRepublican className="text-red-500 mr-2" size={20} />
                Party Rankings
              </h3>
              <div className="space-y-2">
                {Object.entries(mockData.rankings.party).map(([metric, ranking]) => (
                  <div key={metric} className="flex items-center justify-between">
                    <span className="text-sm text-base-content/70 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getRankingColor(ranking, metric)}`}>
                      {ranking}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Rankings */}
            <div className="bg-base-200 rounded-lg p-3 relative">
              <div className="absolute top-2 right-2">
                <HelpTooltip 
                  content="Performance rankings compared to all legislators nationwide. Provides a comprehensive view of this legislator's standing across the entire dataset."
                  placement="left"
                />
              </div>
              <h3 className="font-medium text-base-content mb-3 flex items-center">
                <FaGlobe className="text-green-500 mr-2" size={20} />
                Overall Rankings
              </h3>
              <div className="space-y-2">
                {Object.entries(mockData.rankings.overall).map(([metric, ranking]) => (
                  <div key={metric} className="flex items-center justify-between">
                    <span className="text-sm text-base-content/70 capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getRankingColor(ranking, metric)}`}>
                      {ranking}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Topics with Two Panes */}
        <div className="bg-base-200 rounded-lg p-3">
          <h2 className="text-lg font-semibold text-base-content mb-4">Top Topics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Posts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-base-content">By Posts</h3>
                <HelpTooltip 
                  content="Shows the distribution of topics based on the number of posts made by the legislator. Higher percentages indicate more frequent posting about that topic."
                  placement="left"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mockData.topTopicsByPosts}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {mockData.topTopicsByPosts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {mockData.topTopicsByPosts.map((topic) => (
                    <div key={topic.name} className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: topic.color }}
                      />
                      <span className="text-sm font-medium text-base-content">{topic.name}</span>
                      <span className="text-sm text-base-content/70">{topic.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* By Engagement */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-base-content">By Engagement</h3>
                <HelpTooltip 
                  content="Shows the distribution of topics based on total engagement (likes, shares, comments) received. Higher percentages indicate topics that generate more public interaction."
                  placement="left"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mockData.topTopicsByEngagement}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {mockData.topTopicsByEngagement.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {mockData.topTopicsByEngagement.map((topic) => (
                    <div key={topic.name} className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: topic.color }}
                      />
                      <span className="text-sm font-medium text-base-content">{topic.name}</span>
                      <span className="text-sm text-base-content/70">{topic.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explore Posts Section */}
        <div className="bg-base-200 rounded-lg p-3">
          <h2 className="text-lg font-semibold text-base-content mb-4">Explore Posts</h2>
          
          {/* Sort Filters */}
          <div className="mb-6">
            <h3 className="font-medium text-base-content mb-3">Sort By</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button 
                onClick={() => toggleSort('date')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.date !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaChartLine className="text-blue-500" size={16} />
                  <span className="text-sm font-medium">Date</span>
                </div>
                {getSortIcon('date')}
              </button>

              <button 
                onClick={() => toggleSort('engagement')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.engagement !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaUsers className="text-green-500" size={16} />
                  <span className="text-sm font-medium">Engagement</span>
                </div>
                {getSortIcon('engagement')}
              </button>

              <button 
                onClick={() => toggleSort('civility')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.civility !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center justify-between space-x-2">
                  <FaShieldAlt className="text-red-500" size={16} />
                  <span className="text-sm font-medium">Civility</span>
                </div>
                {getSortIcon('civility')}
              </button>

              <button 
                onClick={() => toggleSort('credibility')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                  sortFilters.credibility !== 'none' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-base-300 bg-base-100 hover:border-base-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaStar className="text-orange-500" size={16} />
                  <span className="text-sm font-medium">Credibility</span>
                </div>
                {getSortIcon('credibility')}
              </button>
            </div>
          </div>
          
          {/* Action Button */}
          <div className="pt-4 border-t border-base-300">
            <button className="btn btn-primary w-full">
              <FaChartLine className="mr-2" />
              View Posts ({formatNumber(mockData.metrics.totalPosts)} total)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// PropTypes validation
LegislatorContext.propTypes = {
  legislator: PropTypes.object,
  setLegislator: PropTypes.func.isRequired,
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  keyword: PropTypes.string,
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired
};
