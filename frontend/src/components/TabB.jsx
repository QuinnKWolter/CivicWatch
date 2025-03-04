import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';

const pieData = [
  { name: 'Group A', value: 500 },
  { name: 'Group B', value: 400 },
  { name: 'Group C', value: 300 },
  { name: 'Group D', value: 200 },
];

const COLORS = ['#FF8042', '#FFBB28', '#00C49F', '#0088FE'];

function TabB() {
  return (
    <div>
      <h3>Pie Chart</h3>
      <PieChart width={300} height={200}>
        <Pie
          data={pieData}
          cx={150}
          cy={100}
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}

export default TabB; 