import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { timeParse } from "d3";

const MARGIN = { top: 30, right: 30, bottom: 50, left: 50 };

export const LineChart = ({ width = 600, height = 400, data = [] }) => {
  const axesRef = useRef(null);
  const boundsWidth = width - MARGIN.right - MARGIN.left;
  const boundsHeight = height - MARGIN.top - MARGIN.bottom;

  const customTimeParser = d3.timeParse("%Y-%m-%d");
  const processedData = data
    .map((d) => ({
      ...d,
      parsedDate: customTimeParser(d.created_at),
    }))
    .filter((d) => d.parsedDate instanceof Date);



  const xScale = d3
    .scaleTime()
    .domain(d3.extent(processedData, (d) => d.parsedDate))
    .range([0, boundsWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(processedData, (d) => d.like_count)])
    .range([boundsHeight, 0]);

  const lineBuilder = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => xScale(d.parsedDate))
    .y((d) => yScale(d.like_count));

  const linePath = lineBuilder(processedData);

  useEffect(() => {
    if (!axesRef.current) return;
    const svg = d3.select(axesRef.current);
    svg.selectAll("*").remove();

    svg
      .append("g")
      .attr("transform", `translate(0, ${boundsHeight})`)
      .call(d3.axisBottom(xScale).ticks(5));

    svg.append("g").call(d3.axisLeft(yScale));
  }, [xScale, yScale, boundsHeight]);

  if (processedData.length === 0) {
    return <div>No valid data to display.</div>;
  }

  return (
    <div>
      <svg width={width} height={height}>
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          <path d={linePath} stroke="#9a6fb0" fill="none" strokeWidth={2} />
          <g ref={axesRef} />
        </g>
      </svg>
    </div>
  );
};
