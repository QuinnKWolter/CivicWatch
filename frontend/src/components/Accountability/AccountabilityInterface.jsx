import React, { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { colorMap } from '../../utils/utils';

function AccountabilityInterface({ startDate, endDate, selectedTopics }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const topicsParam = selectedTopics.join(',');
        const response = await fetch(`http://localhost:8000/api/accountability_interface/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}`);
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log(data);
        setData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching accountability data:", err);
        setError("Failed to load accountability data. Please try again.");
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
        <p className="text-lg">Loading accountability data...</p>
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

  const renderPieChart = (title, dataKey, metric) => {
    if (!data || !data[dataKey]) {
      return <p>No data available</p>;
    }

    const metricKey = metric === 'civility' ? 'civil_vs_uncivil' : 'informative_vs_misinformative';
    const values = dataKey === 'overall' ? data.overall[metricKey] : data.by_party[dataKey][metricKey];

    if (!values) {
      return <p>No data available</p>;
    }

    const [metricValue, totalValue] = values.split('/').map(Number);

    return (
      <PieChart width={200} height={200}>
        <Pie
          data={[
            { name: metric === 'civility' ? 'Civil' : 'Informative', value: metricValue },
            { name: metric === 'civility' ? 'Uncivil' : 'Misinformative', value: totalValue - metricValue }
          ]}
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label
        >
          <Cell key="Civil" fill={colorMap.covid[dataKey === 'overall' ? 'M' : dataKey.charAt(0)]} />
          <Cell key="Uncivil" fill={colorMap.gun[dataKey === 'overall' ? 'M' : dataKey.charAt(0)]} />
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    );
  };

  return (
    <div>
      <h2>Accountability Data</h2>
      <div className="flex flex-col items-center">
        <div className="flex justify-center mb-4">
          <div>
            <h3>Overall Civility</h3>
            {renderPieChart('Overall Civility', 'overall', 'civility')}
          </div>
        </div>
        <div className="flex justify-between w-full">
          <div>
            <h3>Democrat Civility</h3>
            {renderPieChart('Democrat Civility', 'Democratic', 'civility')}
          </div>
          <div>
            <h3>Republican Civility</h3>
            {renderPieChart('Republican Civility', 'Republican', 'civility')}
          </div>
        </div>
        <div className="flex justify-center mt-8 mb-4">
          <div>
            <h3>Overall Misinformation</h3>
            {renderPieChart('Overall Misinformation', 'overall', 'informative')}
          </div>
        </div>
        <div className="flex justify-between w-full">
          <div>
            <h3>Democrat Misinformation</h3>
            {renderPieChart('Democrat Misinformation', 'Democratic', 'informative')}
          </div>
          <div>
            <h3>Republican Misinformation</h3>
            {renderPieChart('Republican Misinformation', 'Republican', 'informative')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountabilityInterface; 