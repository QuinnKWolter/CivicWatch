import { useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import { hexbin } from "d3-hexbin";
import { Tooltip, TooltipGroup } from "./LegislatorTooltip";
import dayjs from "dayjs";

export const LegislatorHex = ({ height, width, startDate, endDate, setLegislatorClicked, legScatterData}) => {
  const marginTop = 30;
  const marginRight = 30;
  const marginBottom = 30;
  const marginLeft = 30;

  const svgRef = useRef(null);
  const [data, setData] = useState([]);

  const [groupHoverData, setGroupHoverData] = useState([]);
  const [clickedTooltip, setClickedTooltip] = useState(false);

  // // Fetch data once on component mount
  // useEffect(() => {
  //   d3.json("/top_50.json")
  //     .then((jsonData) => {
  //       setData(jsonData); // Set data once fetched
  //     })
  //     .catch((err) => {
  //       console.error("Error fetching JSON data:", err);
  //     });
  // }, []); // This effect runs once when the component mounts

  // useEffect(() => {
  //   // Determine whether to use default data or fetch from the server
  //   console.log("Fetching data from server");
  //   fetch("/api/legislators/scatter/")
  //     .then((response) => response.json())
  //     .then((data) => {
  //       console.log("Legislator Data: ", data);
  //       console.log(data[0].name);
  //       setData(data);
  //     })
  //     .catch((error) =>
  //       console.error("Error fetching legislator data:", error)
  //     );
  // }, []);

  // useEffect(() => {
  //   console.log("filtering data");
  //   if (startDate && endDate) {
  //     const url = "/api/legislators/scatter/?";
  //     const params = {
  //       startDate: startDate.format("DD-MM-YYYY"),
  //       endDate: endDate.format("DD-MM-YYYY"),
  //     };
  //     const queryParams = new URLSearchParams(params).toString();

  //     const query = `${url}${queryParams}`;
  //     console.log("query", query);
  //     fetch(query)
  //       .then((response) => response.json())
  //       .then((data) => {
  //         setData(data);
  //       })
  //       .catch((error) =>
  //         console.error("Error filtering legislator data: ", error)
  //       );
  //     const filteredData = data.filter((item) => {
  //       const itemDate = dayjs(item.date);
  //       return (
  //         itemDate.isSameOrAfter(startDate) && itemDate.isSameOrBefore(endDate)
  //       );
  //     });
  //     setData(filteredData);
  //     console.log("done filtering");
  //     console.log("filtered data", filteredData);
  //   }
  // }, [startDate, endDate]);

  // Once data is available, run the D3 code to render the hexbin
  useEffect(() => {
    // if (data.length === 0) return; // Skip rendering if data is not loaded

    console.log("rerendering");

    const cleaned = legScatterData
      .filter(
        (d) => d.total_interactions_tw > 0 && d.overperforming_score_tw > 0
      )
      .map((d) => ({
        ...d,
        total_interactions_tw: Math.max(d.total_interactions_tw, 1),
        overperforming_score_tw: Math.max(d.overperforming_score_tw, 1),
      }));

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    const xExtent = d3.extent(cleaned, (d) => d.total_interactions_tw);
    const yExtent = d3.extent(cleaned, (d) => d.overperforming_score_tw);

    const xScale = d3
      .scaleLog()
      .domain(xExtent)
      .range([marginLeft, width - marginRight]);
    const yScale = d3
      .scaleLog()
      .domain(yExtent)
      .rangeRound([height - marginBottom, marginTop]);

    const hexbins = hexbin()
      .x((d) => xScale(d.total_interactions_tw))
      .y((d) => yScale(d.overperforming_score_tw))
      .radius((10 * width) / 928)
      .extent([
        [marginLeft, marginTop],
        [width - marginRight, height - marginBottom],
      ]);

    const bins = hexbins(cleaned);

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
    let tooltipTimeout;
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
          if (d.party === "D") counts.Democrat += 1;
          if (d.party === "R") counts.Republican += 1;
        });

        const total = counts.Democrat + counts.Republican;
        if (total === 0) return "#ccc"; // fallback if no party data

        // Compute balance: -1 (all Dem), 1 (all Rep), 0 = split
        const balance = (counts.Democrat - counts.Republican) / total;
        return color(balance);
      })

      .on("click", function (event, bin) {
        clearTimeout(tooltipTimeout);
      
        const names = bin.map((d) => d.name);
      
        // Check if we're clicking the same bin again
        if (
          groupHoverData &&
          groupHoverData.names &&
          groupHoverData.names.length === names.length &&
          groupHoverData.names.every((name, i) => name === names[i])
        ) {
          setGroupHoverData(null);
          return;
        }
      
        // Create screen position for tooltip
        const svg = svgRef.current;
        const point = svg.createSVGPoint();
        point.x = bin.x;
        point.y = bin.y;
      
        const screenCTM = svg.getScreenCTM();
        const screenPoint = point.matrixTransform(screenCTM);
        const containerRect = svg.parentNode.getBoundingClientRect();
      
        const xPos = screenPoint.x - containerRect.left;
        const yPos = screenPoint.y - containerRect.top;
      
        setGroupHoverData({ xPos, yPos, bin });
      });
      
  }, [legScatterData, height, width]); // Re-run the effect when data, height, or width changes

  return (
    <div className="flex justify-center items-center w-full h-full">
      <svg ref={svgRef} />
      {groupHoverData && (
        <TooltipGroup
          xPos={groupHoverData.xPos}
          yPos={groupHoverData.yPos}
          data={groupHoverData.bin}
          setLegislatorClicked={setLegislatorClicked}
        />
      )}
    </div>
  );
};
