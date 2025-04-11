import * as d3 from "d3";
import { INNER_RADIUS, RadarGrid } from "./RadarGrid";
const MARGIN = 20;

export const Radar = ({ width, height, data, axisConfig }) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        No data available
      </div>
    );
  }

  const outerRadius = Math.min(width, height) / 2 - MARGIN;
  const variableNames = axisConfig.map((axis) => axis.name);

  const xScale = d3
    .scaleBand()
    .domain(variableNames)
    .range([0, 2 * Math.PI]);

  let yScales = [];
  axisConfig.forEach((axis) => {
    yScales[axis.name] = d3
      .scaleRadial()
      .domain([0, axis.max])
      .range([INNER_RADIUS, outerRadius]);
  });

  const allCoordinates = axisConfig.map((axis) => {
    const yScale = yScales[axis.name];
    const angle = xScale(axis.name) ?? 0;
    const radius = yScale(data[axis.name]);
    return [angle, radius];
  });

  allCoordinates.push(allCoordinates[0]);
  const linePath = d3.lineRadial()(allCoordinates);

  return (
    <div className="flex justify-center items-center w-full h-full">
      <svg 
        width={width} 
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block mx-auto" // Center the SVG horizontally
      >
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          <RadarGrid
            outerRadius={outerRadius}
            xScale={xScale}
            axisConfig={axisConfig}
          />
          <path
            d={linePath}
            stroke={data.party === "R" ? "#FF0000" : data.party === "D" ? "#0000FF" : "#cb1dd1"}
            strokeWidth={3}
            fill={data.party === "R" ? "#FF0000" : data.party === "D" ? "#0000FF" : "#cb1dd1"}
            fillOpacity={0.1}
          />
        </g>
      </svg>
    </div>
  );
};