import React, { useRef, useEffect } from "react";
import { PieChart, Pie, Cell } from "recharts";
import * as d3 from "d3";

const pieData = [
  { name: "Group A", value: 500 },
  { name: "Group B", value: 400 },
  { name: "Group C", value: 300 },
  { name: "Group D", value: 200 },
];

const COLORS = ["#FF8042", "#FFBB28", "#00C49F", "#0088FE"];

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
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
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

// {"post_id": 1, "interaction_score": 0.45, "post_accountability_score": 0.62 }

const ScatterPlot = ({ posts }) => {
  const ref = useRef();

  useEffect(() => {
    const width = 300; // Increased width
    const height = 200; // Increased height
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    console.log("posts: ", posts);
    // Remove any existing SVG
    d3.select(ref.current).selectAll("*").remove();

    // Create SVG canvas
    const svg = d3
      .select(ref.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Define scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(posts, (d) => d.interaction_score) * 1.1])
      .range([0, width - margin.left - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(posts, (d) => d.post_accountability_score) * 1.1])
      .range([height - margin.top - margin.bottom, 0]);

    // Add X axis
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .append("text")
      .attr("x", (width - margin.left - margin.right) / 2)
      .attr("y", 40)
      .attr("fill", "white")
      .style("text-anchor", "middle")
      .text("Interaction Score");

    // Add Y axis
    svg
      .append("g")
      .call(d3.axisLeft(yScale).ticks(5))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -((height - margin.top - margin.bottom) / 2))
      .attr("y", -50)
      .attr("fill", "white")
      .style("text-anchor", "middle")
      .text("Post Accountability Score");

    // Add circles for data points
    svg
      .selectAll("circle")
      .data(posts)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.interaction_score))
      .attr("cy", (d) => yScale(d.post_accountability_score))
      .attr("r", 6)
      .attr("fill", "steelblue")
      .attr("opacity", 0.8)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).attr("fill", "orange");
      })
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget).attr("fill", "steelblue");
      });
  }, [posts]);

  return (
    <div>
      <h3>Scatter Plot</h3>
      <svg ref={ref}></svg>
    </div>
  );
};

export default ScatterPlot;
