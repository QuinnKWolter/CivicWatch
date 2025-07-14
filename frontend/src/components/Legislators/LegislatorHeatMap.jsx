import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

export const LegislatorHeatMap = ({
  height = 900,
  width = 500,
  data,
  legScatterData,
  legislatorClicked,
  setLegislatorClicked,
  party,
  legislator,
  setLegislator,
  match
}) => {
  const margin = { top: 50, right: 30, bottom: 50, left: 156 };
  const svgRef = useRef(null);
  const [rowHeight] = useState(20);
  const [totalHeight, setTotalHeight] = useState(height);
  const [totalWidth, setTotalWidth] = useState(width);
  // const [match, setMatch] = useState(true)

  const handleClick = (name) => {
  const selected = legScatterData.find((d) => d.name === name);
  if (selected) {
    setLegislatorClicked([selected]);
    setLegislator(selected); 
  }
};


  useEffect(() => {
    if (
      legislator &&
      legislator.name &&
      (!legislatorClicked.length ||
        legislator.name !== legislatorClicked[0].name)
    ) {
      const match = legScatterData.find((d) => d.name === legislator.name);
      if (match) {
        setLegislatorClicked([match]);
      }
      
    }
    
  }, [legislator, legScatterData]);

  useEffect(() => {
    console.log("DATA", data);
    console.log("LEGISLATOR", legislator);
    console.log("LEGISLATORCLICKED", legislatorClicked);
    if (!data.length) return;
    // Calculate needed height
    const neededHeight = margin.top + margin.bottom + data.length * rowHeight;
    setTotalHeight(neededHeight);

    // Process data
    const allMonths = new Set();
    const processedData = data.map((legislator) => {
      const months = Object.entries(legislator.monthly_post_counts)
        .map(([monthStr, count]) => {
          const date = d3.timeParse("%Y-%m")(monthStr);
          if (date) allMonths.add(date);
          return { date, count, monthStr };
        })
        .filter((d) => d.date);
      return { ...legislator, months };
    });

    // Create scales
    const monthArray = Array.from(allMonths).sort((a, b) => a - b);
    const names = processedData.map((d) => d.name);

    const minColWidth = 25; // Minimum pixel width per month column
   

    const allDates = d3.timeMonths(
      d3.min(
        data.flatMap((d) =>
          Object.keys(d.monthly_post_counts).map((monthStr) =>
            d3.timeParse("%Y-%m")(monthStr)
          )
        )
      ),
      d3.timeMonth.offset(
        d3.max(
          data.flatMap((d) =>
            Object.keys(d.monthly_post_counts).map((monthStr) =>
              d3.timeParse("%Y-%m")(monthStr)
            )
          )
        ),
        1
      )
    );

    const x = d3
      .scaleBand()
      .domain(monthArray)
      .range([margin.left, width - margin.right])
      .padding(0.05);

    const y = d3
      .scaleBand()
      .domain(names)
      .range([margin.top, neededHeight - margin.bottom])
      .padding(0.2);

    const maxPostedCount = d3.max(
      data.flatMap((d) => Object.values(d.monthly_post_counts))
    );

    const maxCount = d3.max(
      processedData.flatMap((d) => d.months.map((m) => m.count))
    );
    const postCounts = data.flatMap((d) =>
      Object.values(d.monthly_post_counts)
    );

     const neededWidth =
      margin.left + margin.right + minColWidth * allDates.length;
    const finalWidth = Math.max(width, neededWidth); // Keep at least the original width
    setTotalWidth(finalWidth);
    setTotalHeight(neededHeight);
    const q95 = d3.quantile(postCounts.sort(d3.ascending), 0.95); // 95th percentile
    let color;
    // Create a nonlinear color scale focused on typical values
    if (party === 1) {
      color = d3
        .scaleSequential(d3.interpolateBlues)
        .domain([0, q95 * 0.3, q95]) // 30% of 95th percentile as mid-point
        .unknown("#f8f8f8"); // Very light gray for zeros
    } else {
      color = d3
        .scaleSequential(d3.interpolateReds)
        .domain([0, q95 * 0.3, q95]) // 30% of 95th percentile as mid-point
        .unknown("#f8f8f8"); // Very light gray for zeros
    }

    // Clear and setup SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg;
    // .attr("width", width)
    // .attr("height", Math.min(neededHeight, height))
    // .attr("viewBox", `0 0 ${width} ${neededHeight}`)
    // .attr("preserveAspectRatio", "none");

    const g = svg.append("g");

    // X-axis
    g.append("g")
      .attr("transform", `translate(0,${margin.top})`)
      .call(d3.axisTop(x).tickFormat(d3.timeFormat("%b %Y")))
      .selectAll("text")
      .attr("y", 0)
      .attr("x", 9)
      .attr("dy", ".35em")
      .attr("transform", "rotate(-60)")
      .style("text-anchor", "start");

    // Y-axis
    const yAxis = g
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    yAxis
      .selectAll(".tick text")
      .style("font-size", "12px")
      .style("cursor", "pointer")
      .style("fill", "ffffff")
      .style("fill", (legislatorName) =>
        legislatorClicked?.[0]?.name === legislatorName ? "yellow" : "ffffff"
      ) // Highlight selected name
      .on("click", function (event, legislatorName) {
        // setLegislatorClicked(
        //   legScatterData.filter((d) => d.name === legislatorName)
        // );
        handleClick(legislatorName);
      });

    // Heatmap cells
    const cellGroups = g
      .selectAll(".legislator")
      .data(processedData)
      .join("g")
      .attr("class", "legislator")
      .attr("transform", (d) => `translate(0,${y(d.name)})`);

    cellGroups
      .selectAll("rect")
      .data((d) =>
        allDates.map((date) => {
          const monthStr = d3.timeFormat("%Y-%m")(date);
          return {
            date,
            count: d.monthly_post_counts[monthStr] || 0,
            monthStr,
            name: d.name,
          };
        })
      )
      .join("rect")
      .attr("x", (d) => x(d.date))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("y", 0)
      .attr("fill", (d) => color(d.count))
      .on("click", (event, d) => {
        handleClick(d.name);   // <-- Add this
      })
      .append("title")
      .text((d) => `${d.name}: ${d.count} posts in ${d.monthStr}`);

   const legendWidth = Math.min(300, width - margin.left - margin.right - 40);
    const legendHeight = 10;
    const legendX =
      margin.left + (width - margin.left - margin.right - legendWidth) / 2;
    const legendY = neededHeight - margin.bottom + 15;

    const defs = svg.append("defs");
    const gradientId = "legendGradient";

    const gradient = defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    const numStops = 10;
    const legendColorInterpolator =
      party === 1 ? d3.interpolateBlues : d3.interpolateReds;

    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", legendColorInterpolator(t));
    }

    const legendScale = d3
      .scaleLinear()
      .domain([0, q95])
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(4)
      .tickFormat(d3.format(".0f"));

    const legendGroup = g
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    legendGroup
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", `url(#${gradientId})`);

    legendGroup
      .append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "10px")
      .style("fill", "white");

    legendGroup
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -8)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "white")
      .text("Monthly Post Count");

    console.log("Total cells:", processedData.length * allDates.length);
  }, [data, height, width, margin, rowHeight, legislatorClicked, legislator]);

  if (!data?.length ) {
    return (
      <div className="flex items-center justify-center">No data available</div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: `auto`,
        overflowY: "auto",
        overflowX: totalWidth > width ? "auto" : "hidden", // horizontal scroll if needed
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        style={{
          display: "block",
          width: totalWidth > width ? totalWidth : "100%",
          height: `auto`,
        }}
      />
    </div>
  );
};
