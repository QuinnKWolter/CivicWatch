import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FaSpinner } from 'react-icons/fa';

function TrendLineChart({ startDate, endDate, selectedTopics }) {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrendData = async () => {
      setLoading(true);
      try {
        const topicsParam = selectedTopics.join(',');
        console.log('Fetching trend data with:', { startDate, endDate, selectedTopics });
        const response = await fetch(`http://localhost:8000/api/trend_data/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}`);
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('Fetched trend data:', data);
        setTrendData(Object.entries(data).map(([date, values]) => ({ date, ...values })));
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
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="Democratic.totalPosts" stroke="#8884d8" name="Democratic Posts" />
        <Line type="monotone" dataKey="Republican.totalPosts" stroke="#82ca9d" name="Republican Posts" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default TrendLineChart; 