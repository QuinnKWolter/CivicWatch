import * as d3 from "d3";
import { INNER_RADIUS, RadarGrid } from "./RadarGrid";
const MARGIN = 30;

export const Radar = ({ width, height, data, axisConfig }) => {
  console.log("DATA", data);
  // Check if data is undefined or empty before rendering
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{ width: width, height: height }}>No data available</div>
    );
  }

  const outerRadius = Math.min(width, height) / 2 - MARGIN;
  console.log(data);

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

  const lineGenerator = d3.lineRadial();

  const allCoordinates = axisConfig.map((axis) => {
    const yScale = yScales[axis.name];
    const angle = xScale(axis.name) ?? 0;
    const radius = yScale(data[axis.name]);
    const coordinate = [angle, radius];
    return coordinate;
  });

  allCoordinates.push(allCoordinates[0]);
  const linePath = lineGenerator(allCoordinates);

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${width / 2}, ${height / 2})`}>
        <RadarGrid
          outerRadius={outerRadius}
          xScale={xScale}
          axisConfig={axisConfig}
        />
        <path
          d={linePath}
          stroke={
            data.party === "R"
              ? "#FF0000"
              : data.party === "D"
              ? "#0000FF"
              : "#cb1dd1"
          }
          strokeWidth={3}
          fill={
            data.party === "R"
              ? "#FF0000"
              : data.party === "D"
              ? "#0000FF"
              : "#cb1dd1"
          }
          fillOpacity={0.1}
        />
      </g>
    </svg>
  );
};
