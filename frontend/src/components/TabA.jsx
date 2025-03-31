import { useRef, useEffect } from "react";
import * as d3 from "d3";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import PropTypes from "prop-types";

const lineData = [
  { name: "Jan", uv: 400, pv: 2400, amt: 2400 },
  { name: "Feb", uv: 300, pv: 1398, amt: 2210 },
  { name: "Mar", uv: 200, pv: 9800, amt: 2290 },
  { name: "Apr", uv: 278, pv: 3908, amt: 2000 },
  { name: "May", uv: 189, pv: 4800, amt: 2181 },
];

function TabA() {
  return (
    <div>
      <h3>Line Chart</h3>
      <LineChart width={300} height={200} data={lineData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="uv" stroke="#8884d8" />
        <Line type="monotone" dataKey="pv" stroke="#82ca9d" />
      </LineChart>
    </div>
  );
}

const RadarChart = ({ data, metrics }) => {
  const svgRef = useRef();
  // Inside SummaryLegislatorScatter
  useEffect(() => {
    if (data) {
      console.log("data clicked:", data.legislatorClicked[0].name);
    }
  }, [data]);

  useEffect(() => {
    d3.select(svgRef.current).selectAll("*").remove(); // clear whatever is on the svg beforehand

    let current = svgRef.current;

    const width = 300;
    const height = 200;
    const margin = 50;
    const radius = Math.min(width, height) / 2 - margin; // radius for circles

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const angleSlice = (2 * Math.PI) / metrics.length;

    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

    const levels = 5;
    for (let level = 1; level <= levels; level++) {
      svg
        .append("circle")
        .attr("r", (radius / levels) * level)
        .style("fill", "none")
        .style("stroke", "#ccc")
        .style("stroke-dasharray", "2,2"); // radius circles
    }

    metrics.forEach((metric, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const lineCoord = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };

      svg
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", lineCoord.x)
        .attr("y2", lineCoord.y)
        .style("stroke", "#999")
        .style("stroke-width", 1);

      svg
        .append("text")
        .attr("x", lineCoord.x * 1.1)
        .attr("y", lineCoord.y * 1.1)
        .attr("dy", "0.35em")
        .style("font-size", "11px")
        .style(
          "text-anchor",
          angle > Math.PI / 2 && angle < (3 * Math.PI) / 2 ? "end" : "start"
        )
        .style("fill", "white")
        .text(metric.replace("_", " "));
    });

    const radarLine = d3
      .lineRadial()
      .radius((d) => d.value)
      .angle((d) => d.angle)
      .curve(d3.curveLinearClosed);

    return () => {
      d3.select(svgRef.current).selectAll("*").remove();
    };

    // Update chart only when data changes
  }, [data, metrics]);

  return (
    <div>
      <h3>Radar Chart</h3>
      <div className="svg-container">
        <svg ref={svgRef}></svg>
      </div>{" "}
    </div>
  );
};

export default RadarChart;
