import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import dayjs from "dayjs";

export const RidgeLinePlot = ({ width, height, legislatorClicked, startDate, endDate }) => {
  const svgRef = useRef(null);
  const [testData, setTestData] = useState({});
  
  // Remove the allDates state since we can calculate it from testData when needed
  const allPossibleTopics = ["abortion", "blacklivesmatter", "capitol", "climate", "covid", "gun", "immigra", "rights"];

  useEffect(() => {
    

    const url = "http://localhost:8000/api/legislator_posts/?"

    const params = {
      start_date: startDate.format("YYYY-MM-DD"),
      end_date: endDate.format("YYYY-MM-DD"),
      name: legislatorClicked[0].name
    }



    const queryParams = new URLSearchParams(params).toString()
    const query = `${url}${queryParams}`;

    fetch(query)
      .then((response) => response.json())
      .then((data) => {
        console.log(data)
        const updatedData = Object.fromEntries(
          Object.entries(data).map(([topic, posts]) => {
            if (posts.length < 10) {
              posts.forEach(post => post.count = 0);
            }
            return [topic, posts];
          })
        );

        // Fill in missing topics with empty data
        allPossibleTopics.forEach((topic) => {
          if (!updatedData[topic]) {
            updatedData[topic] = [];
          }
        });

        setTestData(updatedData);
      })
      .catch((error) => console.error("Error fetching data", error));
  }, [legislatorClicked, startDate, endDate]); // Remove allDates from dependencies

  useEffect(() => {
    if (Object.keys(testData).length === 0) return;

    const marginTop = 40;
    const marginRight = 30;
    const marginBottom = 30;
    const marginLeft = 70;
    const overlap = 4;

    // Calculate dates from testData
    const dates = Object.values(testData)
      .flat()
      .map((d) => new Date(d.date));
    const dateRange = d3.extent(dates);

    const allDates = [];
    for (let d = new Date(dateRange[0]); d <= dateRange[1]; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d));
    }

    // Rest of your rendering code...
    const topics = Object.keys(testData);
    const x = d3
      .scaleTime()
      .domain(dateRange)
      .range([marginLeft, width - marginRight]);

    const y = d3
      .scalePoint()
      .domain(topics)
      .range([marginTop, height - marginBottom])
      .padding(0.5);

    const globalMaxCount = d3.max(Object.values(testData).flat(), (d) => d.count);

    const normalizeCount = (count) => count / globalMaxCount;

    const z = d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, -overlap * y.step()])
      .clamp(true);

    const area = d3
      .area()
      .curve(d3.curveBasis)
      .defined((d) => d.count !== undefined && !isNaN(d.count))
      .x((d) => x(new Date(d.date)))
      .y0(() => 0)
      .y1((d) => z(normalizeCount(d.count)));

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(topics);

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0, ${height - marginBottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));

    const yAxis = svg
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
        .attr("fill", colorScale(topic))
        .attr("fill-opacity", 0.3)
        .attr("stroke", colorScale(topic))
        .attr("stroke-width", 1)
        .attr("d", area(filledPosts));
    });

    xAxis.selectAll("text")
      .style("font-size", "9px");

    // Move the y-axis labels
    yAxis.selectAll("text")
      .style("font-size", "9px")
    
  }, [testData, width, height]);

  if (!legislatorClicked || Object.keys(legislatorClicked).length === 0) {
    return (
      <div className="flex items-center justify-center">
        No data available
      </div>
    );
  }

  return (
    <>
    <h3>Post Frequency Over Time by Topic</h3>
    <div className="flex justify-center items-center w-full h-full">
      
      <svg ref={svgRef} />
      </div>
    </>
  );
};