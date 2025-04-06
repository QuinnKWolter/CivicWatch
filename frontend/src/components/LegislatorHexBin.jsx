import { useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import { hexbin } from "d3-hexbin";
import { Tooltip, TooltipGroup } from "./Tooltip";

export const LegislatorHex = ({ height, width }) => {
  const marginTop = 30;
  const marginRight = 30;
  const marginBottom = 30;
  const marginLeft = 30;

  const svgRef = useRef(null);
  const [data, setData] = useState([]);

  const [groupHoverData, setGroupHoverData] = useState([]);

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

    bins.forEach((bin) => {
      bin.forEach((d) => {
        console.log("TEST HEX BINS DATA: ", d.name);
      });
    });

    const color = d3.scaleDiverging(d3.interpolateRdBu).domain([-1, 0, 1]);


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
      .attr("fill", (bin) => {
        const counts = { Democrat: 0, Republican: 0 };
      
        bin.forEach((d) => {
          if (d.party === 'D') counts.Democrat += 1;
          if (d.party === 'R') counts.Republican += 1;
        });
      
        const total = counts.Democrat + counts.Republican;
        if (total === 0) return '#ccc'; // fallback if no party data
      
        // Compute balance: -1 (all Dem), 1 (all Rep), 0 = split
        const balance = (counts.Republican - counts.Democrat) / total;
        return color(balance);
      })
      
      .on("mouseenter", function (event, bin) {
        const names = bin.map((d) => d.name);
        setGroupHoverData({ xPos: bin.x,  yPos: bin.y, names: names });
      })
      .on("mouseleave", function () {
        setGroupHoverData(null);
      })
  }, [data, height, width]); // Re-run the effect when data, height, or width changes

  return (<div style={{position: "relative"}}>
    <svg ref={svgRef} />
    {groupHoverData && (
      <TooltipGroup 
        xPos={groupHoverData.xPos + marginLeft + 10}
        yPos={groupHoverData.yPos + marginTop + 10}
        names={groupHoverData.names}
      />
    )

}
    </div>


  );
};
