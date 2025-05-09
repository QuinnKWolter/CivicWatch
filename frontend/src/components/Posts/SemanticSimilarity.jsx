import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Tooltip,
  TooltipGroup,
  TextTip,
} from "../Legislators/LegislatorTooltip";
import { SemanticTooltip } from "../Legislators/SemanticTooltip";
import Tippy from '@tippyjs/react'
import {followCursor} from 'tippy.js'

export const SemanticScatterPlot = ({
  data,
  width ,
  height,
  hoveredSemanticDataRef,
}) => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const margin = { top: 40, right: 40, bottom: 50, left: 60 };
  const [hoverData, setHoverData] = useState([]);
  const [clickedTooltip, setClickedTooltip] = useState(false);
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const updatedColorScale = [
    {
      abortion: "#1f77b4",
      blacklivesmatter: "#ff7f0e",
      capitol: "#2ca02c",
      climate: "#2ca02c",
      covid: "#d62728",
      gun: "#9467bd",
      immigra: "#8c564b",
      rights: "#e377c2",
    },
  ];
  const topics = ["abortion", "blacklivesmatter", "capitol", "climate", "covid", "gun", "immigra", "rights"]

  useEffect(() => {
    if (!data || data.length === 0) return;

    console.log("DATA:" , data)

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous renders

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // --- Scales ---
    const xExtent = d3.extent(data, (d) => d.pca_x);
    const yExtent = d3.extent(data, (d) => d.pca_y);

    // Add a little padding to the extent
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, chartWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([chartHeight, 0]); // Inverted range for SVG y-coordinate

    // Define color scale for party
    const colorScale = d3
      .scaleOrdinal()
      .domain(["Republican", "Democratic"])
      .range(["#E41A1C", "#377EB8"]); // Red for Republican, Blue for Democratic

    // --- Chart Area ---
    const chartArea = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Clip path to prevent points from overflowing axes
    chartArea
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", chartWidth)
      .attr("height", chartHeight);

    // --- Axes ---
    const xAxis = d3.axisBottom(xScale);
    const xAxisGroup = chartArea
      .append("g") // Assign to variable for zoom update
      .attr("class", "x-axis") // Add class for selection
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisGroup
      .append("text") // X Axis Label
      .attr("class", "axis-label")
      .attr("x", chartWidth / 2)
      .attr("y", margin.bottom - 10)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .text("PCA Dimension 1");

    const yAxis = d3.axisLeft(yScale);
    const yAxisGroup = chartArea
      .append("g") // Assign to variable for zoom update
      .attr("class", "y-axis") // Add class for selection
      .call(yAxis);

    yAxisGroup
      .append("text") // Y Axis Label
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -margin.left + 20)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .text("PCA Dimension 2");

    let toolTipTimeout;
    // --- Plot Points ---
    // --- Plot Points ---
    const pointsGroup = chartArea.append("g").attr("clip-path", "url(#clip)"); // Apply clipping

    const points = pointsGroup
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => xScale(d.pca_x))
      .attr("cy", (d) => yScale(d.pca_y))
      .attr("r", 5) // Radius of points
      .attr("fill", (d) => updatedColorScale[0][d.topics__name])
      .attr("fill-opacity", 0.7)
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        // Fixed: 'd' is the single datum
        event.stopPropagation(); // Prevent event from bubbling to zoom
        console.log("Clicked point:", d);

        if (
          hoverData &&
          hoverData.text &&
          hoverData.text.length === text.length &&
          hoverData.text.every((text, i) => text === text[i])
        ) {
          setHoverData(null);
          return;
        }

        const svg = svgRef.current;
        const point = svg.createSVGPoint();
        point.x = xScale(d.pca_x);
        point.y = yScale(d.pca_y);

        console.log("point.x, point.y", point.x, point.y);

        const screenCTM = svg.getScreenCTM();
        const screenPoint = point.matrixTransform(screenCTM);
        const containerRect = svg.parentNode.getBoundingClientRect();

        const xPos = screenPoint.x - containerRect.left;
        const yPos = screenPoint.y - containerRect.top;

        setHoverData({ xPos, yPos, d });
        console.log("set hover data", xPos, yPos, d);

        hoveredSemanticDataRef.current = { xPos, yPos, d };
      })
      .on("mouseover", function (event, d) {
        // event.stopPropagation();

        // const svg = svgRef.current;
        // const chartArea = svg.querySelector("g"); // get <g transform="translate(...)">

        // const point = svg.createSVGPoint();
        // point.x = xScale(d.pca_x);
        // point.y = yScale(d.pca_y);

        // const screenPoint = point.matrixTransform(chartArea.getScreenCTM());
        // const containerRect = svg.getBoundingClientRect();

        // const xPos = screenPoint.x - containerRect.left;
        // const yPos = screenPoint.y - containerRect.top;

        //hoveredSemanticDataRef.current = { xPos, yPos, d };

        setTooltipContent(
          <div
            style={{
              color: "gray",
              borderRadius: "1px",
              padding: "0.5px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center", 
              height: "100%",
              width: "100%",
              lineHeight: "0.8em" 
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <strong style={{ fontSize: "0.5em", color: "white" }}>
                Topic: {d.topics__name}
              </strong>
              <strong style={{ fontSize: "0.5em", color: "white" }}>
                Party: {d.party}
              </strong>
              <strong style={{ fontSize: "0.5em", color: "white" }}>
                Date: {d.created_at.split("T")[0]}
              </strong>
              <strong style={{ fontSize: "0.5em", color: "white" }}>
                Likes: {d.like_count}
              </strong>
              <strong style={{fontSize: "0.5em", color: "white"}}>
                Reposts: {d.retweet_count}
              </strong>
              <strong style={{fontSize: "0.5em", color:"white"}}>
                Author: {d.name}
              </strong>
            </div>
          </div>
        );
        
        setTooltipVisible(true);
      })

      .on("mouseleave", function (event, d) {
        event.stopPropagation();

        
        setTooltipVisible(false);
      });

    // --- Zoom ---
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 20])
      .extent([
        [0, 0],
        [chartWidth, chartHeight],
      ])
      .translateExtent([
        [0, 0],
        [chartWidth, chartHeight],
      ])
      .on("zoom", (event) => {
        const newXScale = event.transform.rescaleX(xScale);
        const newYScale = event.transform.rescaleY(yScale);
        xAxisGroup.call(xAxis.scale(newXScale));
        yAxisGroup.call(yAxis.scale(newYScale));
        pointsGroup
          .selectAll("circle")
          .attr("cx", (d) => newXScale(d.pca_x))
          .attr("cy", (d) => newYScale(d.pca_y));
      });

    // Add the zoom rectangle FIRST, before the points
    chartArea
      .append("rect")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .lower() // Send to back so points are on top
      .call(zoom);
    
    svg
      .selectAll("mydots")
      .data(topics)
      .enter()
      .append("circle")
      .attr("cx", 80)
      .attr("cy", function (d, i) { return 10 + i * 15 })
      .attr("r", 5)
      .style("fill", function (d) { console.log("d", updatedColorScale[d]);  return updatedColorScale[0][d] })
    
    svg
      .selectAll("mylabels")
      .data(topics)
      .enter()
      .append("text")
      .attr("x", 90)
      .attr("y", function (d, i) { return 10 + i * 15})
      .style("fill", function (d) { return updatedColorScale[0][d] })
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")
      .style("font-size", "10px")
      .text(function(d){return d})
  }, [data, width, height]); // Rerun effect if these change

  const [tooltipData, setTooltipData] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hoveredSemanticDataRef.current !== tooltipData) {
        console.log("updated tooltip bc we zoomed or smth");
        setTooltipData(hoveredSemanticDataRef.current);
      }
    }, 1);
    return () => clearInterval(interval);
  }, [hoveredSemanticDataRef, tooltipData]);

  return (
    <div style={{ position: "relative" }}>
      <Tippy
        content={tooltipContent}
        visible={tooltipVisible}
        arrow={false}
        placement="top"
        followCursor={true}
        appendTo={() => document.body}
        plugins={[followCursor]}
      >
        <svg ref={svgRef} width={width} height={height}></svg>
        </Tippy>
      {/* { && (
        // <Tooltip
        //   xPos={hoverData.xPos}
        //   yPos={hoverData.yPos}
        //   name={hoverData.d} />
        <TextTip xPos={hoverData.xPos}
          yPos={hoverData.yPos}
          />
      )} */}
      {/* <SemanticTooltip width={width} height={height} data={tooltipData}  /> */}
      {tooltipData === null ? (
        <div>
          <span className="font-bold text-xs">Post Text:</span> <br></br>
          
        </div>
      ) : (
        <div>
            <span className="font-bold text-xs">Post Text: </span>{" "}
          <span className="text-xs"> { tooltipData.d.text} </span>{" "}
        </div>
      )}
    </div>
  );
};
