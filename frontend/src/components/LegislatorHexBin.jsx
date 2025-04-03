import { useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import { hexbin } from "d3-hexbin";

export const LegislatorHex = ({ height, width }) => {
  const marginTop = 30;
  const marginRight = 30;
  const marginBottom = 30;
  const marginLeft = 30;

  const svgRef = useRef(null);
  const [data, setData] = useState([]);

  // Fetch data once on component mount
  useEffect(() => {
    d3.json("/top_50.json")
      .then((jsonData) => {
        setData(jsonData); // Set data once fetched
      })
      .catch((err) => {
        console.error("Error fetching JSON data:", err);
      });
  }, []); // This effect runs once when the component mounts

  // Once data is available, run the D3 code to render the hexbin
  useEffect(() => {
    if (data.length === 0) return; // Skip rendering if data is not loaded

    const svg = d3.select(svgRef.current).attr("viewBox", [0, 0, width, height]);

    const xScale = d3
      .scaleLog()
      .domain(d3.extent(data, (d) => d.total_interactions_tw))
      .range([marginLeft, width - marginRight]);

    const yScale = d3
      .scaleLog()
      .domain(d3.extent(data, (d) => d.overperforming_score_tw))
      .rangeRound([height - marginBottom, marginTop]);

    const hexbins = hexbin()
      .x((d) => xScale(d.total_interactions_tw))
      .y((d) => yScale(d.overperforming_score_tw))
      .radius((10 * width) / 928)
      .extent([
        [marginLeft, marginTop],
        [width - marginRight, height - marginBottom],
      ]);

    const bins = hexbins(data);

    const color = d3
      .scaleSequential(d3.interpolateRdBu)
      .domain([0, d3.max(bins, (d) => d.length) / 2]);

    // Clear previous SVG elements
    svg.selectAll("*").remove();

    // Add bottom axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(xScale).ticks(width / 80, ""))
      .call((g) =>
        g
          .append("text")
          .attr("x", width - marginRight)
          .attr("y", -4)
          .attr("fill", "currentColor")
          .attr("font-weight", "bold")
          .attr("text-anchor", "end")
          .text("Total Interactions")
      );

    // Add left axis
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft}, 0)`)
      .call(d3.axisLeft(yScale).ticks(null, "k"))
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .append("text")
          .attr("x", 4)
          .attr("y", marginTop)
          .attr("dy", ".71em")
          .attr("fill", "currentColor")
          .attr("font-weight", "bold")
          .attr("text-anchor", "start")
          .text("Overperforming Score")
      );

    // Add hexbin paths
    svg
      .append("g")
      .attr("fill", "#ddd")
      .attr("stroke", "white")
      .selectAll("path")
      .data(bins)
      .enter()
      .append("path")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("d", hexbins.hexagon())
      .attr("fill", (bin) => color(bin.length));
  }, [data, height, width]); // Re-run the effect when data, height, or width changes

  return <svg ref={svgRef} />;
};
