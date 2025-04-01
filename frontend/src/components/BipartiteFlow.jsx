import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

const data = [
  { name: 'Q4 \'19', topic1: 0, topic2: 0, topic3: 0, topic4: 0, topic5: 0, topic6: 0 },
  { name: 'Q1 \'20', topic1: 4000, topic2: 2400, topic3: 2400, topic4: 3000, topic5: 2000, topic6: 2780 },
  { name: 'Q2 \'20', topic1: 3000, topic2: 1398, topic3: 2210, topic4: 1890, topic5: 2390, topic6: 3490 },
  { name: 'Q3 \'20', topic1: 2000, topic2: 9800, topic3: 2290, topic4: 3908, topic5: 4800, topic6: 4300 },
  { name: 'Q4 \'20', topic1: 2780, topic2: 3908, topic3: 2000, topic4: 2181, topic5: 2500, topic6: 2100 },
  { name: 'Q1 \'21', topic1: 1890, topic2: 4800, topic3: 2181, topic4: 2500, topic5: 2100, topic6: 4000 },
  { name: 'Q2 \'21', topic1: 2390, topic2: 3800, topic3: 2500, topic4: 4000, topic5: 1398, topic6: 9800 },
  { name: 'Q3 \'21', topic1: 3490, topic2: 4300, topic3: 2100, topic4: 3000, topic5: 2210, topic6: 2290 },
  { name: 'Q4 \'21', topic1: 4000, topic2: 2400, topic3: 2400, topic4: 2780, topic5: 3000, topic6: 2000 },
];

const colorMap = {
  topic1: { blue: '#1E3A8A', red: '#7F1D1D', purple: '#6D28D9' },
  topic2: { blue: '#2563EB', red: '#B91C1C', purple: '#8B5CF6' },
  topic3: { blue: '#3B82F6', red: '#DC2626', purple: '#A78BFA' },
  topic4: { blue: '#60A5FA', red: '#EF4444', purple: '#C4B5FD' },
  topic5: { blue: '#93C5FD', red: '#F87171', purple: '#DDD6FE' },
  topic6: { blue: '#BFDBFE', red: '#FCA5A5', purple: '#EDE9FE' },
};

function BipartiteFlow({ activeTopics }) {
  const chartRef = useRef();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hoveredData, setHoveredData] = useState(null);

  useEffect(() => {
    const container = chartRef.current;
    const resizeObserver = new ResizeObserver(() => {
      drawChart();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeTopics]);

  const drawChart = () => {
    const container = chartRef.current;
    const containerWidth = container.offsetWidth || 800; 
    const containerHeight = container.offsetHeight || 800; 
    const margin = { top: 20, right: 30, bottom: 30, left: 50 }; 
    const width = containerWidth - margin.left - margin.right; // 100% of container width
    const height = (containerHeight * 0.4) - margin.top - margin.bottom; // 40% of container height

    const svg = d3.select(container);
    svg.selectAll("*").remove(); // Clear previous content

    // Main group for upper chart
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // x scale: switch to scalePoint so each quarter lines up in the center
    const x = d3.scalePoint()
      .domain(data.map(d => d.name))
      .range([0, width])
      .padding(0); // Set padding to 0 to align with the axes

    // figure out how wide we'd like "hover highlight" rects
    const step = x.step();  

    // y scale for the upper chart
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d =>
        d3.sum(activeTopics.map(topic => d[topic]))
      )])
      .nice()
      .range([height, 0]);

    // stack setup for the upper chart
    const stack = d3.stack()
      .keys(activeTopics)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const layers = stack(data);

    // area generator for the upper chart
    const area = d3.area()
      .x(d => x(d.data.name))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    // render stacked areas (blue)
    g.selectAll(".layer")
      .data(layers)
      .enter().append("path")
      .attr("class", "layer")
      .attr("d", area)
      .style("fill", d => colorMap[d.key].blue);

    // X axis (bottom)
    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(-height).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

    // Y axis (left)
    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).tickSize(-width).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

    // Lower chart group
    const gLower = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top + height + 50})`);

    // y scale for the lower chart (flipped area)
    const yLower = d3.scaleLinear()
      .domain([0, d3.max(data, d =>
        d3.sum(activeTopics.map(topic => d[topic]))
      )])
      .nice()
      .range([0, height]); // goes downward for the stacked shape

    // area generator for the lower chart
    const areaLower = d3.area()
      .x(d => x(d.data.name))
      .y0(d => yLower(d[0]))
      .y1(d => yLower(d[1]));

    // render stacked areas (red) in the lower chart
    gLower.selectAll(".layer")
      .data(layers)
      .enter().append("path")
      .attr("class", "layer")
      .attr("d", areaLower)
      .style("fill", d => colorMap[d.key].red);

    // X axis (top) for lower chart
    gLower.append("g")
      .attr("class", "axis axis--x")
      .call(d3.axisTop(x).tickSize(-height).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

    // Y axis (left) for lower chart
    gLower.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(yLower).tickSize(-width).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

    // Highlight rectangles for hover
    const highlightRectUpper = g.append("rect")
      .attr("class", "highlight-rect")
      .attr("width", step * 0.8)
      .attr("height", height)
      .attr("fill", "rgba(255, 255, 255, 0.3)")
      .style("pointer-events", "none")
      .style("opacity", 0);

    const highlightRectLower = gLower.append("rect")
      .attr("class", "highlight-rect")
      .attr("width", step * 0.8)
      .attr("height", height)
      .attr("fill", "rgba(255, 255, 255, 0.3)")
      .style("pointer-events", "none")
      .style("opacity", 0);

    const handleMouseOver = function(event, layer, isUpperChart) {
      const [xPos] = d3.pointer(event);
      const closest = data.reduce((prev, curr) => {
        return (Math.abs(x(curr.name) - xPos) < Math.abs(x(prev.name) - xPos) ? curr : prev);
      });

      const dataPoint = layer.find(d => d.data.name === closest.name);
      if (!dataPoint) {
        console.warn("No data point found for quarter:", closest.name, "in layer:", layer);
        return;
      }

      // DEBUG: Log hovered topic and temporal bin (quarter)
      console.log(`Hovered Topic: ${layer.key}, Quarter: ${closest.name}`);

      // Set hovered data for React tooltip
      setHoveredData({ topic: layer.key, quarter: closest.name });

      const rectX = x(closest.name) - (step * 0.4);

      const highlightRect = isUpperChart ? highlightRectUpper : highlightRectLower;
      if (isUpperChart) {
        highlightRect
          .attr("x", rectX)
          .attr("y", Math.min(y(dataPoint[0]), y(dataPoint[1])))
          .attr("height", Math.abs(y(dataPoint[0]) - y(dataPoint[1])))
          .style("opacity", 1);
      } else {
        highlightRect
          .attr("x", rectX)
          .attr("y", yLower(dataPoint[0]))
          .attr("height", Math.abs(yLower(dataPoint[1]) - yLower(dataPoint[0])))
          .style("opacity", 1);
      }
    };

    const handleMouseOut = function() {
      console.log("Mouse out - Hiding tooltip");
      setHoveredData(null);
      highlightRectUpper.style("opacity", 0);
      highlightRectLower.style("opacity", 0);
    };

    // Add mouseleave event to hide tooltip when leaving the chart area
    svg.on("mouseleave", handleMouseOut);

    // Attach events to both upper and lower layers
    g.selectAll(".layer")
      .on("mouseover", function(event, d) { handleMouseOver(event, d, true); })
      .on("mouseout", handleMouseOut);

    gLower.selectAll(".layer")
      .on("mouseover", function(event, d) { handleMouseOver(event, d, false); })
      .on("mouseout", handleMouseOut);

    // Add event listener for mouse movement
    window.addEventListener('mousemove', (event) => {
      setMousePosition({ x: event.pageX, y: event.pageY });
    });

    return () => window.removeEventListener('mousemove', (event) => {
      setMousePosition({ x: event.pageX, y: event.pageY });
    });
  };

  useEffect(() => {
    drawChart();
  }, [activeTopics]);

  useEffect(() => {
    console.log("Hovered Data Changed:", hoveredData);
  }, [hoveredData]);

  return (
    <div className="relative w-full h-full">
      <svg ref={chartRef} width="100%" height="100%"></svg>
      {hoveredData && hoveredData.topic && hoveredData.quarter && (
        <div
          className="absolute bg-gray-800 border border-gray-700 rounded shadow-lg p-4 text-white"
          style={{
            left: mousePosition.x - chartRef.current.getBoundingClientRect().left - 100,
            top: mousePosition.y - chartRef.current.getBoundingClientRect().top + 50,
            pointerEvents: 'none',
            width: 200,
            zIndex: 50,
          }}
        >
          {console.log("Rendering Tooltip:", hoveredData)}

          <h6 className="text-lg mb-2">Topic Details</h6>
          <p className="mb-1">Topic: {hoveredData.topic || "No topic found"}</p>
          <p>Quarter: {hoveredData.quarter || "No quarter found"}</p>
        </div>
      )}
    </div>
  );
}

export default BipartiteFlow;
