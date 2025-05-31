import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import dayjs from "dayjs";
import { colorMap } from "../../utils/utils";

export const RidgeLinePlot = ({ width, height, legislatorClicked, startDate, endDate }) => {
  const svgRef = useRef(null);
  const [testData, setTestData] = useState({});
  
  // Remove the allDates state since we can calculate it from testData when needed
  const allPossibleTopics = ["capitol", "immigra", "abortion", "blacklivesmatter", "climate", "gun", "rights", "covid"];

  useEffect(() => {
    

    const url = "/api/legislator_posts/?"

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

    
    const topics = allPossibleTopics;
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

    console.log("ColorScale:", d3.schemeCategory10)

    console.log("topics", topics)
    

    const updatedColorScale = [{ "abortion": "#1f77b4" ,  "blacklivesmatter": "#ff7f0e" ,  "capitol": "#2ca02c" ,  "climate": "#2ca02c" ,  "covid": "#d62728" ,  "gun": "#9467bd" ,  "immigra": "#8c564b" ,  "rights": "#e377c2" }]
    
    console.log("dtw", updatedColorScale)
    
  

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      // .attr("width", width)
      // .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet")

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


      console.log("topic", topic);
      console.log("party", legislatorClicked[0].party)
      const party = legislatorClicked[0].party
      if (!colorMap[topic]) {
  console.warn(`Missing color mapping for topic: ${topic}`);
}
      d3.select(this)
        .append("path")
        .attr("fill", colorMap[topic][party])
        .attr("fill-opacity", 0.3)
        .attr("stroke", colorMap[topic][party])
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
      <h3 className="text-center mb-2">Post Frequency Over Time by Topic</h3>
      <div className="w-full" width={width} height={height} style={{ border: "1px solid #eee" }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        />
      </div>
    </>
  );
  
  
};