import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

export const RidgeLinePlot = ({ width, height, legislatorClicked }) => {
  const svgRef = useRef(null);
  const [testData, setTestData] = useState({});

  useEffect(() => {
    fetch(`http://localhost:8000/api/legislator_posts/?name=${legislatorClicked.name}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("ridgeLine data:", data);
        setTestData(data);
      })
      .catch((error) => console.error("Error fetching data", error));
  }, [legislatorClicked]);

  useEffect(() => {
    if (Object.keys(testData).length === 0) return;

    const marginTop = 40;
    const marginRight = 20;
    const marginBottom = 30;
    const marginLeft = 120;
    const overlap = 4;

   
    const dates = Object.values(testData)
      .flat()
      .map((d) => new Date(d.date));

    const dateRange = d3.extent(dates);

    
    const allDates = [];
    for (let d = new Date(dateRange[0]); d <= dateRange[1]; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d));
    }

    
    const topics = Object.keys(testData);
    console.log("topics", topics);

    
    const x = d3
      .scaleTime()
      .domain(dateRange)
      .range([marginLeft, width - marginRight]);

    
    const y = d3
      .scalePoint()
      .domain(topics)
      .range([marginTop, height - marginBottom])
      .padding(0.5);

   
    const globalMaxCount = d3.max(
      Object.values(testData).flat(),
      (d) => d.count
    );

   
    const normalizeCount = (count) => count / globalMaxCount;

    
    const z = d3
      .scaleLinear()
      .domain([0, 1]) // Normalized to [0, 1]
      .range([0, -overlap * y.step()]);

    const area = d3
      .area()
      .curve(d3.curveBasis)
      .defined((d) => d.count !== undefined && !isNaN(d.count))
      .x((d) => x(new Date(d.date))) // Map each date to the x-axis
      .y0(0)
      .y1((d) => z(normalizeCount(d.count))); // Normalize count for y position

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(topics);
      
 
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    svg
      .append("g")
      .attr("transform", `translate(0, ${height - marginBottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));

    svg
      .append("g")
      .attr("transform", `translate(${marginLeft}, 0)`)
      .call(d3.axisLeft(y).tickSize(0).tickPadding(5))
      .call((g) => g.select(".domain").remove());

   
    const group = svg
      .append("g")
      .selectAll("g")
      .data(topics)
      .join("g")
      .attr("transform", (topic) => `translate(0,${y(topic)})`);

    group.each(function (topic) {
      const posts = testData[topic] || [];

      
      const dateMap = new Map();
      posts.forEach((post) => {
        const postDate = new Date(post.date).toISOString();
        dateMap.set(postDate, post.count);
      });

     
      const filledPosts = allDates.map((date) => ({
        date: date.toISOString(),
        count: dateMap.get(date.toISOString()) || 0, 
      }));

    
      d3.select(this)
        .append("path")
        .attr("fill", "none")
        .attr("stroke", colorScale(topic)) 
        .attr("d", area(filledPosts)); 
    });
  }, [testData, width, height]);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} />
    </div>
  );
};
