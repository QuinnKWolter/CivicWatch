import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

export const RidgeLinePlot = ({ width, height, legislatorClicked }) => {
  const svgRef = useRef(null);
  const [testData, setTestData] = useState({});
  const [allDates, setAllDates] = useState([]);

  const allPossibleTopics = ["abortion", "blacklivesmatter", "capitol", "climate", "covid", "gun", "immigra", "rights"]

  useEffect(() => {
    fetch(`http://localhost:8000/api/legislator_posts/?name=${legislatorClicked.name}`)
      .then((response) => response.json())
      .then((data) => {
        
        const updatedData = Object.fromEntries(
          Object.entries(data).map(([topic, posts]) => {
            if (posts.length < 10) {
              // Set count to 0 for all posts in topics with fewer than 10 posts
              posts.forEach(post => post.count = 0);
            }
            return [topic, posts];
          })
        );

        const dates = Object.values(updatedData)
          .flat()
          .map((d) => new Date(d.date));
        const dateRange = d3.extent(dates);

        const newAllDates = [];
        for (let d = new Date(dateRange[0]); d <= dateRange[1]; d.setDate(d.getDate() + 1)) {
          newAllDates.push(new Date(d));
        }

        setAllDates(newAllDates);
        

        allPossibleTopics.forEach((topic) => {
          if (!updatedData[topic]) {
            // Create empty posts with zero counts for this topic
            updatedData[topic] = allDates.map((date) => ({
              date: date.toISOString(),
              count: 0,
            }));
          }
        });

        setTestData(updatedData);
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
        .attr("fill", colorScale(topic))
        .attr("fill-opacity", 0.3)
        .attr("stroke", colorScale(topic))
        .attr("stroke-width", 1)
        .attr("d", area(filledPosts));

      // Optional: red baseline to debug
      /*
      d3.select(this)
        .append("line")
        .attr("x1", marginLeft)
        .attr("x2", width - marginRight)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "red")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,2");
      */
    });
  }, [testData, width, height]);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} />
    </div>
  );
};
