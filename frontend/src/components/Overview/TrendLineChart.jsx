import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FaSpinner } from 'react-icons/fa';
import { formatNumber, colorMap } from '../../utils/utils';
import dayjs from 'dayjs';

function TrendLineChart({ startDate, endDate, selectedTopics }) {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrendData = async () => {
      setLoading(true);
      try {
        const defaultStartDate = '2020-01-01';
        const defaultEndDate = '2021-12-31';
        const defaultTopics = Object.keys(colorMap); // Assuming colorMap is imported

        let response;
        if (
          startDate.format('YYYY-MM-DD') === defaultStartDate &&
          endDate.format('YYYY-MM-DD') === defaultEndDate &&
          selectedTopics.length === defaultTopics.length &&
          selectedTopics.every(topic => defaultTopics.includes(topic))
        ) {
          // Fetch default data
          response = await fetch('http://localhost:8000/api/default_trendline_data/');
        } else {
          // Fetch regular data
          const topicsParam = selectedTopics.join(',');
          response = await fetch(`http://localhost:8000/api/trend_data/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}`);
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('Fetched trend data:', data);
        setTrendData(Object.entries(data).map(([date, values]) => ({
          date,
          DemocraticPosts: values.Democratic?.totalPosts || 0,
          RepublicanPosts: values.Republican?.totalPosts || 0,
          DemocraticEngagement: values.Democratic?.totalEngagement || 0,
          RepublicanEngagement: values.Republican?.totalEngagement || 0,
        })));
        setError(null);
      } catch (err) {
        console.error("Error fetching trend data:", err);
        setError("Failed to load trend data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrendData();
  }, [startDate, endDate, selectedTopics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading trend data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={(date) => dayjs(date).format('MMM D, YYYY')}
          angle={-45}
          textAnchor="end"
        />
        <YAxis yAxisId="left" label={{ value: 'Posts', angle: -90, position: 'insideLeft' }} tickFormatter={formatNumber} />
        <YAxis yAxisId="right" orientation="right" label={{ value: 'Engagement', angle: 90, position: 'insideRight' }} tickFormatter={formatNumber} />
        <Tooltip 
          formatter={(value) => formatNumber(value)} 
          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none' }} 
        />
        <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 50 }} />
        <Line yAxisId="left" type="monotone" dataKey="DemocraticPosts" stroke="#66b3ff" name="Democratic Posts" dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="RepublicanPosts" stroke="#ff9999" name="Republican Posts" dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="DemocraticEngagement" stroke="#005bb5" name="Democratic Engagement" dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="RepublicanEngagement" stroke="#b30000" name="Republican Engagement" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default TrendLineChart; 