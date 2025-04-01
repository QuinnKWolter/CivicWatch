import React from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const data = [
  { name: "Party A", posts: 4000, engagement: 2400 },
  { name: "Party B", posts: 3000, engagement: 1398 },
  { name: "Party C", posts: 2000, engagement: 9800 },
];

const lineData = [
  { name: "Jan", civility: 400, misinformation: 240 },
  { name: "Feb", civility: 300, misinformation: 139 },
  { name: "Mar", civility: 200, misinformation: 980 },
];

const pieData = [
  { name: "Topic 1", value: 400 },
  { name: "Topic 2", value: 300 },
  { name: "Topic 3", value: 300 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

function OverviewCharts() {
  return (
    <div className="flex flex-col space-y-4">
      <h6 className="text-lg">Overview Charts</h6>
      
      <div className="flex justify-center">
        <BarChart width={600} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="posts" fill="#8884d8" />
          <Bar dataKey="engagement" fill="#82ca9d" />
        </BarChart>
      </div>

      <div className="flex justify-center">
        <LineChart width={600} height={300} data={lineData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="civility" stroke="#8884d8" />
          <Line type="monotone" dataKey="misinformation" stroke="#82ca9d" />
        </LineChart>
      </div>

      <div className="flex justify-center">
        <PieChart width={400} height={400}>
          <Pie data={pieData} cx={200} cy={200} outerRadius={150} fill="#8884d8" dataKey="value">
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </div>
    </div>
  );
}

export default OverviewCharts; 