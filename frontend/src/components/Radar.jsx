import * as d3 from "d3";
import { useEffect, useMemo} from "react";
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



  const newData = data[0];

  const { outerRadius, variableNames, xScale, yScales, allCoordinates, linePath } = useMemo(() => {
   
    const outerRadius = Math.min(width, height) / 2 - MARGIN;
    const variableNames = axisConfig.map((axis) => axis.name);

    const xScale = d3
      .scaleBand()
      .domain(variableNames)
      .range([0, 2 * Math.PI]);

    let yScales = {};
    axisConfig.forEach((axis) => {
      yScales[axis.name] = d3
        .scaleRadial()
        .domain([0, axis.max])
        .range([INNER_RADIUS, outerRadius]);
    });

    const allCoordinates = axisConfig.map((axis) => {
      const yScale = yScales[axis.name];
      const angle = xScale(axis.name) ?? 0;
      const radius = yScale(newData[axis.name]);
      return [angle, radius];
    });

    allCoordinates.push(allCoordinates[0]);
    const linePath = d3.lineRadial()(allCoordinates);

    return { outerRadius, variableNames, xScale, yScales, allCoordinates, linePath };
  }, [width, height, newData, axisConfig]); // Recalculate when these change
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
            stroke={newData.party === "R" ? "#FF0000" : newData.party === "D" ? "#0000FF" : "#cb1dd1"}
            strokeWidth={3}
            fill={newData.party === "R" ? "#FF0000" : newData.party === "D" ? "#0000FF" : "#cb1dd1"}
            fillOpacity={0.1}
          />
        </g>
      </svg>
    </div>
  );
};