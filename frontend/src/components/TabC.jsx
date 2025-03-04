import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const barData = [
  { name: 'Group A', uv: 6000, pv: 2400, amt: 2400 },
  { name: 'Group B', uv: 5000, pv: 1398, amt: 2210 },
  { name: 'Group C', uv: 4000, pv: 9800, amt: 2290 },
  { name: 'Group D', uv: 3000, pv: 3908, amt: 2000 },
  { name: 'Group E', uv: 2000, pv: 4800, amt: 2181 },
];

function TabC() {
  return (
    <div>
      <h3>Bar Chart</h3>
      <BarChart width={300} height={200} data={barData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="uv" fill="#8884d8" />
        <Bar dataKey="pv" fill="#82ca9d" />
      </BarChart>
    </div>
  );
}

export default TabC; 