import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  FaChartBar, FaChartLine, FaBullseye, FaSpinner, 
  FaNewspaper, FaThumbsUp, FaRetweet, FaExchangeAlt 
} from "react-icons/fa";
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import TrendLineChart from './TrendLineChart'; // Import the new component
import { colorMap } from './BipartiteFlow'; // Import colorMap

function OverviewCharts({ startDate, endDate, selectedTopics = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Color configuration
  const colors = {
    democratic: "#0088FE", // blue for Democratic
    republican: "#FF8042", // red-orange for Republican
    posts: "#8884d8",
    likes: "#82ca9d",
    retweets: "#ffc658",
    engagement: "#ff7c43",
    democraticLight: "#66b3ff", // lighter blue for Democratic
    democraticDark: "#005bb5", // darker blue for Democratic
    republicanLight: "#ff9999", // lighter red for Republican
    republicanDark: "#b30000" // darker red for Republican
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

  // Function to format large numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

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
  
  // Separate data for Democrats and Republicans
  const democratData = visualizations.radarChartMetrics.find(item => item.party === 'Democratic');
  const republicanData = visualizations.radarChartMetrics.find(item => item.party === 'Republican');

  const democratRadarData = [
    { metric: "Civility Score", value: democratData.avgCivilityScore },
    { metric: "Misinformation Score", value: democratData.avgMisinfoScore * 100 },
    { metric: "Interaction Score", value: democratData.avgInteractionScore }
  ];

  const republicanRadarData = [
    { metric: "Civility Score", value: republicanData.avgCivilityScore },
    { metric: "Misinformation Score", value: republicanData.avgMisinfoScore * 100 },
    { metric: "Interaction Score", value: republicanData.avgInteractionScore }
  ];

  return (
    <div className="flex flex-col space-y-4 p-2">
      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(summaryMetrics).map(([party, metrics]) => (
          <div key={party} className="card shadow-md">
            <div className="card-body p-2">
              <h2 className="card-title text-lg flex items-center">
                <div className={`w-3 h-3 rounded-full mr-1 ${party === 'Democratic' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                {party === 'Democratic' ? 'Democrats' : 'Republicans'}
              </h2>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Total number of posts made by legislators in this party">
                  <span className="stat-value text-primary text-base"><FaNewspaper className="text-xl text-primary" />{formatNumber(metrics.totalPosts)}</span>
                </div>
                
                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Average interaction score (TODO - WHAT IS THIS METRIC SPECIFICALLY?)">
                  <span className="stat-value text-secondary text-base"><FaExchangeAlt className="text-xl text-secondary" />{metrics.avgInteractionScore?.toFixed(2)}</span>
                </div>
                
                <div className="stat bg-base-100 rounded-box p-2 flex items-center text-center" data-tippy-content="Total likes for all posts">
                  <span className="stat-value text-accent text-base"><FaThumbsUp className="text-xl text-accent" />{formatNumber(metrics.totalLikes)}</span>
                </div>
                
                <div className="stat bg-base-100 rounded-box p-2 flex items-center" data-tippy-content="Total retweets for all posts">
                  <span className="stat-value text-info text-base"><FaRetweet className="text-xl text-info" />{formatNumber(metrics.totalRetweets)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar Chart Section */}
      <div className="card shadow-md">
        <div className="card-body p-2">
          <h2 className="card-title flex items-center text-lg">
            <FaChartBar className="mr-1" />
            Party Engagement Summary
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={visualizations.barChartPartySummary}
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
                <Bar yAxisId="left" dataKey="totalPosts" name="Total Posts" fill={colors.democraticLight} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="likes" name="Likes" fill={colors.democraticDark} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="retweets" name="Retweets" fill={colors.republicanLight} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Radar Charts Section */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        {/* Radar Chart for Democrats */}
        <div className="card shadow-md flex-1">
          <div className="card-body p-2">
            <h2 className="card-title flex items-center text-lg">
              <FaBullseye className="mr-1" />
              Democratic Metrics
            </h2>
            <div className="flex justify-center h-64">
              <ResponsiveContainer width="100%" aspect={1}>
                <RadarChart outerRadius="70%" data={democratRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 1]} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}`} />
                  <Legend />
                  <Radar 
                    name="Democratic Metrics" 
                    dataKey="value" 
                    stroke={colors.democratic} 
                    fill={colors.democratic} 
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
            <h2 className="card-title flex items-center text-lg">
              <FaBullseye className="mr-1" />
              Republican Metrics
            </h2>
            <div className="flex justify-center h-64">
              <ResponsiveContainer width="100%" aspect={1}>
                <RadarChart outerRadius="70%" data={republicanRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 1]} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}`} />
                  <Legend />
                  <Radar 
                    name="Republican Metrics" 
                    dataKey="value" 
                    stroke={colors.republican} 
                    fill={colors.republican} 
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

      {/* Line Chart Section */}
      <div className="card shadow-md">
        <div className="card-body p-2">
          <h2 className="card-title flex items-center text-lg">
            <FaChartLine className="mr-1" />
            Engagement Trends Over Time
          </h2>
          <div className="h-80">
            <TrendLineChart startDate={startDate} endDate={endDate} selectedTopics={selectedTopics} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewCharts; 