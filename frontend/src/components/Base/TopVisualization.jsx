import { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { FaChartBar } from 'react-icons/fa';
import SectionTitle from '../SectionTitle';

// Enhanced mock data with engagement-based positioning
const mockData = {
  topic: 'BlackLivesMatter',
  keywords: [
    // High accountability (green) keywords - positive community terms
    { word: 'Solidarity', engagement: 12500, accountability: 0.9, cluster: 'positive' },
    { word: 'Brotherhood', engagement: 8900, accountability: 0.85, cluster: 'positive' },
    { word: 'Stand Together', engagement: 11200, accountability: 0.88, cluster: 'positive' },
    { word: 'Justice', engagement: 15600, accountability: 0.92, cluster: 'positive' },
    { word: 'Equality', engagement: 13400, accountability: 0.87, cluster: 'positive' },
    { word: 'Unity', engagement: 9800, accountability: 0.83, cluster: 'positive' },
    { word: 'Peaceful', engagement: 7600, accountability: 0.81, cluster: 'positive' },
    { word: 'Community', engagement: 14200, accountability: 0.89, cluster: 'positive' },
    
    // Medium accountability (yellow/orange) keywords - neutral event terms
    { word: 'George Floyd', engagement: 18900, accountability: 0.6, cluster: 'neutral' },
    { word: 'Protest', engagement: 16700, accountability: 0.55, cluster: 'neutral' },
    { word: 'Assemble', engagement: 9200, accountability: 0.58, cluster: 'neutral' },
    { word: 'March', engagement: 13400, accountability: 0.52, cluster: 'neutral' },
    { word: 'Rally', engagement: 7800, accountability: 0.54, cluster: 'neutral' },
    { word: 'Demonstration', engagement: 6500, accountability: 0.56, cluster: 'neutral' },
    { word: 'Activism', engagement: 11200, accountability: 0.59, cluster: 'neutral' },
    { word: 'Movement', engagement: 15600, accountability: 0.57, cluster: 'neutral' },
    
    // Low accountability (red) keywords - negative opposition terms
    { word: 'Thug', engagement: 3400, accountability: 0.15, cluster: 'negative' },
    { word: 'Riots', engagement: 2800, accountability: 0.12, cluster: 'negative' },
    { word: 'Blue Lives Matter', engagement: 4200, accountability: 0.18, cluster: 'negative' },
    { word: 'All Lives Matter', engagement: 3800, accountability: 0.16, cluster: 'negative' },
    { word: 'Violence', engagement: 2100, accountability: 0.08, cluster: 'negative' },
    { word: 'Looting', engagement: 1800, accountability: 0.05, cluster: 'negative' },
    { word: 'Chaos', engagement: 1500, accountability: 0.06, cluster: 'negative' },
    { word: 'Anarchy', engagement: 1200, accountability: 0.04, cluster: 'negative' }
  ]
};

export default function TopVisualization({
  // eslint-disable-next-line no-unused-vars
  activeTopics,
  // eslint-disable-next-line no-unused-vars
  startDate,
  // eslint-disable-next-line no-unused-vars
  endDate,
  // eslint-disable-next-line no-unused-vars
  legislator,
  // eslint-disable-next-line no-unused-vars
  keyword
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredWord, setHoveredWord] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      setDimensions({ width, height });
    };

    updateDimensions();
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDimensions, 100);
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const margin = { top: 40, right: 140, bottom: 40, left: 40 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleLinear().domain([0, 1]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    // Color scale for accountability - shifted for more realistic social media decorum
    const colorScale = d3.scaleLinear()
      .domain([0, 0.15, 0.35, 0.55, 0.75, 1])
      .range(['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#16a34a', '#059669']);

    // Create background
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "#f8fafc")
      .style("opacity", 0.3);

    // Calculate engagement-based positioning
    const maxEngagement = d3.max(mockData.keywords, d => d.engagement);
    const minEngagement = d3.min(mockData.keywords, d => d.engagement);
    
    // Sort keywords by engagement (highest first)
    const sortedKeywords = [...mockData.keywords].sort((a, b) => b.engagement - a.engagement);
    
    // Position keywords radially based on engagement
    const positionedKeywords = sortedKeywords.map((keyword, index) => {
      const engagementRatio = (keyword.engagement - minEngagement) / (maxEngagement - minEngagement);
      
      // Most engaged keyword goes to center, others radiate outward
      let radius, angle;
      
      if (index === 0) {
        // Center keyword
        radius = 0;
        angle = 0;
      } else {
        // Radial positioning for others
        const baseRadius = 0.3; // Base distance from center
        const radiusIncrement = 0.15; // How much further each ring is
        const ringIndex = Math.floor((index - 1) / 8); // 8 keywords per ring
        radius = baseRadius + (ringIndex * radiusIncrement);
        
        // Distribute evenly around the circle
        const positionInRing = (index - 1) % 8;
        angle = (positionInRing / 8) * 2 * Math.PI;
        
        // Add some randomness to avoid perfect circles
        const randomOffset = (Math.random() - 0.5) * 0.1;
        radius += randomOffset;
        angle += randomOffset;
      }
      
      // Convert polar to cartesian coordinates
      const x = 0.5 + radius * Math.cos(angle);
      const y = 0.5 + radius * Math.sin(angle);
      
      return {
        ...keyword,
        x: Math.max(0.05, Math.min(0.95, x)),
        y: Math.max(0.05, Math.min(0.95, y)),
        radius: radius,
        angle: angle,
        engagementRatio: engagementRatio
      };
    });

    // Generate semantic blob data using the new positioning
    const gridSize = 100;
    const blobData = new Array(gridSize * gridSize);
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = i / gridSize;
        const y = j / gridSize;
        
        let totalInfluence = 0;
        let weightedAccountability = 0;
        let totalWeight = 0;
        
        // Calculate influence from each positioned word
        positionedKeywords.forEach(word => {
          const distance = Math.sqrt(Math.pow(x - word.x, 2) + Math.pow(y - word.y, 2));
          
          // Engagement determines the "force" of the influence
          const force = (word.engagement / 20000) * 4;
          
          // Gaussian kernel for smooth falloff
          const weight = force * Math.exp(-distance / 0.12);
          
          if (weight > 0.001) {
            totalInfluence += weight;
            weightedAccountability += weight * word.accountability;
            totalWeight += weight;
          }
        });
        
        const index = i + j * gridSize;
        if (totalWeight > 0) {
          blobData[index] = {
            influence: totalInfluence,
            accountability: weightedAccountability / totalWeight
          };
        } else {
          blobData[index] = { influence: 0, accountability: 0.5 };
        }
      }
    }

    // Create filled semantic blobs using marching squares - adjusted thresholds for decorum
    const accountabilityThresholds = [0.1, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85];
    
    accountabilityThresholds.forEach(threshold => {
      const contours = d3.contours()
        .size([gridSize, gridSize])
        .thresholds([threshold])(blobData.map(d => d.accountability));
      
      // Create filled polygons for each accountability level
      svg.selectAll(`.blob-${Math.floor(threshold * 10)}`)
        .data(contours)
        .enter()
        .append("path")
        .attr("class", `blob-${Math.floor(threshold * 10)}`)
        .attr("d", d3.geoPath())
        .style("fill", colorScale(threshold))
        .style("opacity", 0.6)
        .style("stroke", "none")
        .attr("transform", `scale(${width / gridSize}, ${height / gridSize})`);
    });

    // Add engagement-based influence contours (energy field effect)
    const influenceContours = d3.contours()
      .size([gridSize, gridSize])
      .thresholds(d3.range(0.5, 4, 0.5))(blobData.map(d => d.influence));

    svg.selectAll(".influence-contour")
      .data(influenceContours)
      .enter()
      .append("path")
      .attr("class", "influence-contour")
      .attr("d", d3.geoPath())
      .style("fill", "none")
      .style("stroke", "rgba(255,255,255,0.1)")
      .style("stroke-width", 1)
      .style("opacity", 0.6)
      .attr("transform", `scale(${width / gridSize}, ${height / gridSize})`);

    // Font size scale based on engagement
    const fontSize = d3.scaleLinear()
      .domain([0, d3.max(mockData.keywords, d => d.engagement)])
      .range([14, 32]);

    // Add words embedded in the semantic blobs (no individual circles)
    const wordGroups = svg.selectAll(".word-group")
      .data(positionedKeywords)
      .enter()
      .append("g")
      .attr("class", "word-group")
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        setHoveredWord(d);
        d3.select(this).select("text").style("font-weight", "900");
        d3.select(this).select("text").style("font-size", `${fontSize(d.engagement) + 2}px`);
      })
      .on("mouseout", function(event, d) {
        setHoveredWord(null);
        d3.select(this).select("text").style("font-weight", "bold");
        d3.select(this).select("text").style("font-size", `${fontSize(d.engagement)}px`);
      });

    // Add word text (no background circles)
    wordGroups.append("text")
      .attr("x", d => xScale(d.x))
      .attr("y", d => yScale(d.y))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", d => `${fontSize(d.engagement)}px`)
      .style("font-weight", "bold")
      .style("fill", "#ffffff")
      .style("text-shadow", "2px 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)")
      .style("pointer-events", "none")
      .text(d => d.word);

    // Add engagement rings (subtle visual guides)
    const maxRadius = d3.max(positionedKeywords, d => d.radius);
    const ringCount = 4;
    
    for (let i = 1; i <= ringCount; i++) {
      const ringRadius = (maxRadius / ringCount) * i;
      const centerX = xScale(0.5);
      const centerY = yScale(0.5);
      const scaledRadius = ringRadius * Math.min(width, height) * 0.8;
      
      svg.append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", scaledRadius)
        .style("fill", "none")
        .style("stroke", "rgba(255,255,255,0.05)")
        .style("stroke-width", 1)
        .style("stroke-dasharray", "5,5");
    }

    // Add enhanced legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width + 20}, 0)`);

    const legendData = [
      { color: "#059669", label: "Very High Accountability", range: "0.75-1.0" },
      { color: "#16a34a", label: "High Accountability", range: "0.55-0.75" },
      { color: "#eab308", label: "Medium-High Accountability", range: "0.35-0.55" },
      { color: "#f59e0b", label: "Medium Accountability", range: "0.15-0.35" },
      { color: "#ea580c", label: "Low Accountability", range: "0.0-0.15" },
      { color: "#dc2626", label: "Very Low Accountability", range: "0.0-0.15" }
    ];

    legend.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text("Accountability Levels");

    legend.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 25)
      .attr("width", 15)
      .attr("height", 15)
      .style("fill", d => d.color)
      .style("stroke", "#666")
      .style("stroke-width", 1)
      .style("border-radius", "2px");

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 20)
      .attr("y", (d, i) => i * 25 + 12)
      .style("font-size", "11px")
      .style("fill", "#333")
      .text(d => d.label);

    legend.selectAll(".range-text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("class", "range-text")
      .attr("x", 20)
      .attr("y", (d, i) => i * 25 + 22)
      .style("font-size", "9px")
      .style("fill", "#666")
      .text(d => d.range);

    // Add title for the radial engagement approach
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text("Radial Engagement Field");

  }, [dimensions.width, dimensions.height]);

  return (
    <div className="flex flex-col w-full h-full p-2">
      <SectionTitle
        icon={<FaChartBar />}
        text="Semantic Topic Space"
        helpContent={
          <div className="text-left">
            <p>This visualization creates a radial engagement field where influence radiates from the center.</p>
            <p>The layout represents:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><span className="font-semibold">Center Focus:</span> Most engaged keyword at the center</li>
              <li><span className="font-semibold">Radial Energy:</span> Engagement decreases as you move outward</li>
              <li><span className="font-semibold">Semantic Blobs:</span> Colored regions show accountability levels</li>
              <li><span className="font-semibold">Energy Rings:</span> Subtle rings show engagement zones</li>
            </ul>
            <p className="mt-2">Hover over words to see detailed metrics. The visualization shows how engagement creates a force field around the central topic.</p>
          </div>
        }
      />
      <div className="card shadow-md bg-base-300 flex-1 overflow-hidden">
        <div className="card-body p-2 flex flex-col h-full">
          {hoveredWord && (
            <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 border">
              <div className="font-bold text-lg">{hoveredWord.word}</div>
              <div className="text-sm text-gray-600">
                Engagement: {hoveredWord.engagement.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                Accountability: {(hoveredWord.accountability * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Cluster: {hoveredWord.cluster}
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
        </div>
      </div>
    </div>
  );
}

TopVisualization.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  legislator: PropTypes.object,
  keyword: PropTypes.string
};
