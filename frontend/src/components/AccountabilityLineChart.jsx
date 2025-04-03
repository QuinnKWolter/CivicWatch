import React, { useRef, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PropTypes from 'prop-types';

const data = [
  { date: '2023-01-01', value: 400 },
  { date: '2023-02-01', value: 300 },
  { date: '2023-03-01', value: 500 },
  { date: '2023-04-01', value: 200 },
  { date: '2023-05-01', value: 350 },
];

function AccountabilityLineChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}

AccountabilityLineChart.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number
};

export default AccountabilityLineChart; 