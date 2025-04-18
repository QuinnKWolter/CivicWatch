import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { FaChartBar, FaChartLine, FaBullseye, FaSpinner, FaNewspaper, FaThumbsUp, FaRetweet, FaExchangeAlt, FaDemocrat, FaRepublican, FaUserFriends, FaExclamationTriangle, FaHandshakeSlash, FaMapMarkerAlt } from "react-icons/fa";
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import TrendLineChart from './TrendLineChart';
import { colorMap, formatNumber } from '../../utils/utils';

function OverviewCharts({ startDate, endDate, selectedTopics = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Updated color configuration
  const colors = {
    democraticPosts: "#66b3ff",
    democraticLikes: "#003366",
    democraticRetweets: "#005bb5",
    republicanPosts: "#ff9999",
    republicanLikes: "#660000",
    republicanRetweets: "#b30000",
  };

  useEffect(() => {
    // Initialize tooltips on elements with data-tippy-content
    tippy('[data-tippy-content]', {
      theme: 'light',
      placement: 'top',
      arrow: true
    });
  }, [data]); // Re-run when data changes

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const defaultStartDate = '2020-01-01';
        const defaultEndDate = '2021-12-31';
        const defaultTopics = Object.keys(colorMap); // Use colorMap to determine defaultTopics

        let response;
        if (
          startDate.format('YYYY-MM-DD') === defaultStartDate &&
          endDate.format('YYYY-MM-DD') === defaultEndDate &&
          selectedTopics.length === defaultTopics.length &&
          selectedTopics.every(topic => defaultTopics.includes(topic))
        ) {
          // Fetch default data
          response = await fetch('http://localhost:8000/api/default_overview_data/');
        } else {
          // Fetch regular data
          const topicsParam = selectedTopics.join(',');
          response = await fetch(`http://localhost:8000/api/overview_metrics/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}`);
        }

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        console.log(data);
        setData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching overview metrics:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, selectedTopics]);

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
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summaryMetrics, visualizations } = data;

  // Check if visualizations and radarChartMetrics exist
  if (!visualizations || !visualizations.radarChartMetrics) {
    console.error("Radar chart metrics data is missing:", visualizations);
    return (
      <div className="alert alert-warning shadow-lg">
        <div>
          <span>Data for radar chart metrics is unavailable. Please check the backend response.</span>
        </div>
      </div>
    );
  }
  
  // Determine if the date range is greater than 365 days
  const isWeekly = endDate.diff(startDate, 'days') > 365;

  // Separate data for Democrats and Republicans
  const democratData = visualizations.radarChartMetrics.find(item => item.party === 'Democratic');
  const republicanData = visualizations.radarChartMetrics.find(item => item.party === 'Republican');

  const democratRadarData = [
    { metric: "Civility Score", value: democratData.avgCivilityScore },
    { metric: "Misinformation Score", value: democratData.avgMisinfoScore },
    { metric: "Interaction Score", value: democratData.avgInteractionScore }
  ];

  const republicanRadarData = [
    { metric: "Civility Score", value: republicanData.avgCivilityScore },
    { metric: "Misinformation Score", value: republicanData.avgMisinfoScore },
    { metric: "Interaction Score", value: republicanData.avgInteractionScore }
  ];

  // Separate data for Democrats and Republicans
  const democratDataBar = visualizations.barChartPartySummary.filter(item => item.party === 'Democratic');
  const republicanDataBar = visualizations.barChartPartySummary.filter(item => item.party === 'Republican');

  return (
    <div className="flex flex-col space-y-4 p-2">
      {/* Summary Metrics Cards */}
      <h2 className="text-lg flex items-center">
        <FaChartBar className="mr-1" />
        Summary Metrics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(summaryMetrics).map(([party, metrics]) => (
          <div key={party} className="card shadow-md">
            <div className="card-body p-2">
              <h2 className="card-title text-lg flex items-center">
                {party === 'Democratic' ? (
                  <FaDemocrat className="text-blue-500 mr-1" />
                ) : (
                  <FaRepublican className="text-red-500 mr-1" />
                )}
                {party === 'Democratic' ? 'Democrats' : 'Republicans'}
              </h2>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Total number of posts made by legislators in this party">
                  <span className="stat-value text-primary text-base"><FaNewspaper className="text-xl text-primary" />{formatNumber(metrics.totalPosts)}</span>
                </div>
                
                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Average interaction score">
                  <span className="stat-value text-secondary text-base"><FaExchangeAlt className="text-xl text-secondary" />{metrics.avgInteractionScore?.toFixed(2)}</span>
                </div>
                
                <div className="stat bg-base-100 rounded-box p-2 flex items-center text-center" data-tippy-content="Total likes for all posts">
                  <span className="stat-value text-accent text-base"><FaThumbsUp className="text-xl text-accent" />{formatNumber(metrics.totalLikes)}</span>
                </div>
                
                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Total retweets for all posts">
                  <span className="stat-value text-info text-base"><FaRetweet className="text-xl text-info" />{formatNumber(metrics.totalRetweets)}</span>
                </div>

                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Number of legislators">
                  <span className="stat-value text-success text-base"><FaUserFriends className="text-xl text-success" />{metrics.numberLegislators}</span>
                </div>

                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Most active state">
                  <span className="stat-value text-warning text-base"><FaMapMarkerAlt className="text-xl text-warning" />{metrics.mostActiveState}</span>
                </div>

                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Number of uncivil posts">
                  <span className="stat-value text-error text-base"><FaHandshakeSlash className="text-xl text-error" />{metrics.numUncivilPosts}</span>
                </div>

                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Number of misinformation posts">
                  <span className="stat-value text-error text-base"><FaExclamationTriangle className="text-xl text-error" />{metrics.numMisinfoPosts}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar Charts Section */}
      <h2 className="text-lg flex items-center">
        <FaChartBar className="mr-1" />
        Engagement Summary
      </h2>
      <div className="flex flex-row space-x-2">
        {/* Bar Chart for Democrats */}
        <div className="card shadow-md flex-1">
          <div className="card-body p-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={democratDataBar}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="party" />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    label={{ value: 'Post Count', angle: -90, position: 'insideLeft' }}
                    tickFormatter={formatNumber}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    label={{ value: 'Engagement (Likes/Retweets)', angle: 90, position: 'insideRight' }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip formatter={(value) => formatNumber(value)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalPosts" name="Total Posts" fill={colors.democraticPosts} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="retweets" name="Retweets" fill={colors.democraticRetweets} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="likes" name="Likes" fill={colors.democraticLikes} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bar Chart for Republicans */}
        <div className="card shadow-md flex-1">
          <div className="card-body p-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={republicanDataBar}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="party" />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    label={{ value: 'Post Count', angle: -90, position: 'insideLeft' }}
                    tickFormatter={formatNumber}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    label={{ value: 'Engagement (Likes/Retweets)', angle: 90, position: 'insideRight' }}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip formatter={(value) => formatNumber(value)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalPosts" name="Total Posts" fill={colors.republicanPosts} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="retweets" name="Retweets" fill={colors.republicanRetweets} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="likes" name="Likes" fill={colors.republicanLikes} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Line Chart Section */}
      <h2 className="text-lg flex items-center">
        <FaChartLine className="mr-1" />
        Engagement Trends Over Time {isWeekly ? "(Weekly)" : "(Daily)"}
      </h2>
      <div className="card shadow-md">
        <div className="card-body p-2">
          <div className="h-80">
            <TrendLineChart startDate={startDate} endDate={endDate} selectedTopics={selectedTopics} />
          </div>
        </div>
      </div>

      {/* Radar Charts Section */}
      <h2 className="text-lg flex items-center">
        <FaBullseye className="mr-1" />
        Party Metrics
      </h2>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        {/* Radar Chart for Democrats */}
        <div className="card shadow-md flex-1">
          <div className="card-body p-2">
            <div className="flex justify-center h-64">
              <ResponsiveContainer width="100%" aspect={1}>
                <RadarChart outerRadius="70%" data={democratRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={({ payload, x, y }) => {
                      const charMap = {
                        "Civility Score": { char: "🤝", dx: 0, dy: -10 },
                        "Misinformation Score": { char: "⚠️", dx: 0, dy: 0 },
                        "Interaction Score": { char: "🔗", dx: -10, dy: 0 }
                      };
                      const { char, dx, dy } = charMap[payload.value];
                      return (
                        <text x={x} y={y} dx={dx} dy={dy} textAnchor="middle" dominantBaseline="central">
                          {char}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 1]} />
                  <Tooltip 
                    formatter={(value) => `${value.toFixed(2)}`} 
                    contentStyle={{ backgroundColor: 'var(--daisyui-base-100)', borderRadius: '5px' }}
                    itemStyle={{ color: 'var(--daisyui-base-content)' }}
                  />
                  <Legend />
                  <Radar 
                    name="Democratic Metrics" 
                    dataKey="value" 
                    stroke={colors.democraticRetweets} 
                    fill={colors.democraticRetweets} 
                    fillOpacity={0.6} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-sm">
              {democratRadarData.map((item, index) => (
                <div key={index}>
                  <strong>{item.metric}:</strong> {item.value.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Radar Chart for Republicans */}
        <div className="card shadow-md flex-1">
          <div className="card-body p-2">
            <div className="flex justify-center h-64">
              <ResponsiveContainer width="100%" aspect={1}>
                <RadarChart outerRadius="70%" data={republicanRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={({ payload, x, y }) => {
                      const charMap = {
                        "Civility Score": { char: "🤝", dx: 0, dy: -10 },
                        "Misinformation Score": { char: "⚠️", dx: 0, dy: 0 },
                        "Interaction Score": { char: "🔗", dx: -10, dy: 0 }
                      };
                      const { char, dx, dy } = charMap[payload.value];
                      return (
                        <text x={x} y={y} dx={dx} dy={dy} textAnchor="middle" dominantBaseline="central">
                          {char}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 1]} />
                  <Tooltip 
                    formatter={(value) => `${value.toFixed(2)}`} 
                    contentStyle={{ backgroundColor: 'var(--daisyui-base-100)', borderRadius: '5px' }}
                    itemStyle={{ color: 'var(--daisyui-base-content)' }}
                  />
                  <Legend />
                  <Radar 
                    name="Republican Metrics" 
                    dataKey="value" 
                    stroke={colors.republicanRetweets} 
                    fill={colors.republicanRetweets} 
                    fillOpacity={0.6} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-sm">
              {republicanRadarData.map((item, index) => (
                <div key={index}>
                  <strong>{item.metric}:</strong> {item.value.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewCharts; 