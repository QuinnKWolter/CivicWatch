import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import PropTypes from 'prop-types';

function StackedAreaChart({ data, activeTopics, colorMap, inverted }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      setDimensions({ width, height });
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    const svg = d3.select(containerRef.current).select('svg');
    svg.selectAll("*").remove();

    const svgElement = svg.append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    const g = svgElement.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const parsedData = data.map(d => ({ ...d, date: parseDate(d.date) }));

    // Sort data by date
    parsedData.sort((a, b) => a.date - b.date);

    const x = d3.scalePoint()
      .domain(parsedData.map(d => d.date))
      .range([0, chartWidth])
      .padding(0.5);

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d =>
        d3.sum(activeTopics.map(topic => d[topic]?.[inverted ? 'R' : 'D']?.posts || 0))
      )])
      .nice()
      .range(inverted ? [0, chartHeight] : [chartHeight, 0]);

    const stack = d3.stack()
      .keys(activeTopics)
      .value((d, key) => d[key]?.[inverted ? 'R' : 'D']?.posts || 0)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const layers = stack(parsedData);

    const area = d3.area()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    g.selectAll(".layer")
      .data(layers)
      .enter().append("path")
      .attr("class", "layer")
      .attr("d", area)
      .style("fill", d => colorMap[d.key]?.[inverted ? 'R' : 'D']);

    const xAxisDates = parsedData.filter((d, i, arr) => {
      const date = d.date;
      return date.getDate() === 1 || (i > 0 && arr[i - 1].date.getMonth() !== date.getMonth());
    }).map(d => d.date);

    const xAxis = inverted ? d3.axisTop(x) : d3.axisBottom(x);
    xAxis.tickValues(xAxisDates)
      .tickSize(-chartHeight)
      .tickPadding(10)
      .tickFormat(d3.timeFormat("%b '%y"));

    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0,${inverted ? 0 : chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", inverted ? "translate(0,-10) rotate(-45)" : "rotate(-45)")
      .style("text-anchor", "end");

    g.selectAll(".axis--x line")
      .style("stroke-opacity", 0.2);

    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).tickSize(-chartWidth).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

  }, [data, activeTopics, colorMap, inverted, dimensions.width, dimensions.height]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg width="100%" height="100%" />
    </div>
  );
}

StackedAreaChart.propTypes = {
  data: PropTypes.array.isRequired,
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  colorMap: PropTypes.object.isRequired,
  inverted: PropTypes.bool.isRequired
};

export default StackedAreaChart;