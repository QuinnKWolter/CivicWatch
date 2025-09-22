import { useRef, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { FaProjectDiagram } from 'react-icons/fa';
import SectionTitle from './SectionTitle';
import { colorMap, topicNames } from '../utils/utils';

// CSV parsing utilities with better handling of quoted fields
const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    // Simple CSV parsing - handles basic cases
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Don't forget the last value
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  }).filter(row => Object.values(row).some(val => val)); // Filter out empty rows
};

export default function NetworkGraph({
  activeTopics = ['all'],
  // eslint-disable-next-line no-unused-vars
  startDate,
  // eslint-disable-next-line no-unused-vars
  endDate,
  // eslint-disable-next-line no-unused-vars
  legislator,
  keyword
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [networkData, setNetworkData] = useState({ nodes: [], edges: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const lastRenderRef = useRef({ width: 0, height: 0, nodesLength: 0, edgesLength: 0 });
  const stableFilteredDataRef = useRef({ nodes: [], edges: [] });

  // Load and parse CSV data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Loading CSV data...');
        
        const [nodesResponse, edgesResponse, postsResponse] = await Promise.all([
          fetch('/nodes.csv'),
          fetch('/edges.csv'),
          fetch('/posts.csv')
        ]);

        console.log('Responses received:', {
          nodes: nodesResponse.ok,
          edges: edgesResponse.ok,
          posts: postsResponse.ok
        });

        if (!nodesResponse.ok || !edgesResponse.ok || !postsResponse.ok) {
          throw new Error('Failed to fetch CSV files');
        }

        const [nodesText, edgesText, postsText] = await Promise.all([
          nodesResponse.text(),
          edgesResponse.text(),
          postsResponse.text()
        ]);

        console.log('CSV text lengths:', {
          nodes: nodesText.length,
          edges: edgesText.length,
          posts: postsText.length
        });

        const nodes = parseCSV(nodesText).map(node => ({
          ...node,
          TotalEngagement: parseInt(node.TotalEngagement) || 0,
          AverageCivility: parseFloat(node.AverageCivility) || 0,
          PostCount: parseInt(node.PostCount) || 0
        }));

        const edges = parseCSV(edgesText).map(edge => ({
          ...edge,
          Weight: parseInt(edge.Weight) || 0,
          EngagementSum: parseInt(edge.EngagementSum) || 0
        }));

        const posts = parseCSV(postsText).map(post => ({
          ...post,
          engagement: parseInt(post.engagement) || 0,
          civility: parseFloat(post.civility) || 0
        }));

        console.log('Parsed data:', {
          nodesCount: nodes.length,
          edgesCount: edges.length,
          postsCount: posts.length
        });

        setNetworkData({ nodes, edges, posts });
      } catch (error) {
        console.error('Error loading network data:', error);
        console.log('Falling back to mock data');
        // Fallback to mock data if CSV loading fails
        setNetworkData({
          nodes: generateMockNodes(),
          edges: generateMockEdges(),
          posts: generateMockPosts()
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter data based on active topics - using stable reference
  const filteredData = useMemo(() => {
    console.log('🔄 filteredData useMemo called with:', {
      nodesLength: networkData.nodes.length,
      edgesLength: networkData.edges.length,
      activeTopics,
      keyword
    });
    
    if (!networkData.nodes.length) {
      const emptyResult = { nodes: [], edges: [] };
      stableFilteredDataRef.current = emptyResult;
      return emptyResult;
    }

    let filteredNodes = networkData.nodes;
    
    // Filter by active topics
    if (!activeTopics.includes('all')) {
      filteredNodes = filteredNodes.filter(node => 
        activeTopics.includes(node.Topic)
      );
    }

    // Filter by keyword if specified
    if (keyword && keyword.trim()) {
      const searchTerm = keyword.toLowerCase().trim();
      filteredNodes = filteredNodes.filter(node =>
        node.Label.toLowerCase().includes(searchTerm)
      );
    }

    // Filter edges to only include connections between filtered nodes
    const nodeIds = new Set(filteredNodes.map(node => node.Id));
    const filteredEdges = networkData.edges.filter(edge =>
      nodeIds.has(edge.Source) && nodeIds.has(edge.Target)
    );

    const result = { nodes: filteredNodes, edges: filteredEdges };
    
    // Only update the ref if the data actually changed
    const prev = stableFilteredDataRef.current;
    if (prev.nodes.length !== result.nodes.length || prev.edges.length !== result.edges.length) {
      console.log('🔄 filteredData changed:', {
        from: { nodes: prev.nodes.length, edges: prev.edges.length },
        to: { nodes: result.nodes.length, edges: result.edges.length }
      });
      stableFilteredDataRef.current = result;
    } else {
      console.log('🔄 filteredData unchanged, returning stable reference');
      return stableFilteredDataRef.current;
    }
    
    return result;
  }, [networkData.nodes, networkData.edges, activeTopics, keyword]);

  // Handle container resizing
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;
      
      // Get the parent container dimensions (the card-body)
      const parent = container.parentElement;
      if (!parent) return;
      
      const parentRect = parent.getBoundingClientRect();
      
      // Calculate available space, accounting for other elements in the parent
      // Subtract space for debug info and padding
      const availableWidth = parentRect.width - 16; // Account for padding
      const availableHeight = parentRect.height - 40; // Account for debug info and padding
      
      // Ensure minimum dimensions and round to avoid sub-pixel changes
      const finalWidth = Math.max(Math.round(availableWidth), 400);
      const finalHeight = Math.max(Math.round(availableHeight), 400);
      
      // Only update if dimensions actually changed significantly (avoid micro-changes)
      setDimensions(prev => {
        const widthDiff = Math.abs(prev.width - finalWidth);
        const heightDiff = Math.abs(prev.height - finalHeight);
        
        if (widthDiff > 20 || heightDiff > 20) {
          console.log('📏 Container dimensions update:', { 
            from: prev, 
            to: { width: finalWidth, height: finalHeight },
            diffs: { width: widthDiff, height: heightDiff }
          });
          return { width: finalWidth, height: finalHeight };
        } else {
          console.log('📏 Dimensions unchanged (within threshold):', {
            current: prev,
            measured: { width: finalWidth, height: finalHeight },
            diffs: { width: widthDiff, height: heightDiff }
          });
        }
        return prev;
      });
    };

    // Initial update with a delay to ensure parent is rendered
    const timeoutId = setTimeout(updateDimensions, 100);
    
    // Debounced resize observer to prevent rapid firing
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateDimensions, 150);
    });
    
    // Observe a higher-level container that won't be affected by SVG size
    // Go up the DOM tree to find the card container
    let observeTarget = containerRef.current.parentElement;
    while (observeTarget && !observeTarget.classList.contains('card')) {
      observeTarget = observeTarget.parentElement;
    }
    
    if (observeTarget) {
      console.log('📏 Observing container:', observeTarget.className);
      resizeObserver.observe(observeTarget);
    } else {
      // Fallback to parent
      const parent = containerRef.current.parentElement;
      if (parent) {
        resizeObserver.observe(parent);
      }
    }
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, []);

  // Main visualization effect
  useEffect(() => {
    const currentState = {
      width: dimensions.width,
      height: dimensions.height,
      loading,
      nodesLength: filteredData.nodes.length,
      edgesLength: filteredData.edges.length
    };
    
    console.log('🔄 Main visualization effect called:', currentState);
    console.log('🔍 Dependencies changed:', {
      dimensions: dimensions,
      filteredDataRef: filteredData,
      loading: loading
    });
    
    if (!dimensions.width || !dimensions.height || loading || !filteredData.nodes.length) {
      console.log('⏭️ Skipping visualization render due to missing requirements');
      return;
    }
    
    // Check if we actually need to re-render
    const lastRender = lastRenderRef.current;
    const needsRender = (
      lastRender.width !== currentState.width ||
      lastRender.height !== currentState.height ||
      lastRender.nodesLength !== currentState.nodesLength ||
      lastRender.edgesLength !== currentState.edgesLength
    );
    
    console.log('🔍 Render check:', {
      lastRender,
      currentState,
      needsRender,
      widthChanged: lastRender.width !== currentState.width,
      heightChanged: lastRender.height !== currentState.height,
      nodesChanged: lastRender.nodesLength !== currentState.nodesLength,
      edgesChanged: lastRender.edgesLength !== currentState.edgesLength
    });
    
    if (!needsRender) {
      console.log('⏭️ Skipping visualization render - no significant changes');
      return;
    }
    
    console.log('🎨 Starting visualization render...');
    lastRenderRef.current = currentState;

    const margin = { top: 40, right: 140, bottom: 40, left: 40 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .style("max-width", "100%")
      .style("max-height", "100%")
      .style("overflow", "visible");

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Add reset zoom button
    const resetButton = svg.append("g")
      .attr("class", "reset-button")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .style("cursor", "pointer")
      .on("click", () => {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity.translate(margin.left, margin.top)
        );
      });

    resetButton.append("rect")
      .attr("width", 80)
      .attr("height", 25)
      .attr("rx", 3)
      .style("fill", "#4f46e5")
      .style("opacity", 0.8);

    resetButton.append("text")
      .attr("x", 40)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Reset Zoom");

    // Main group with initial transform
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare node data with positioning
    const nodes = filteredData.nodes.map(node => ({
      ...node,
      id: node.Id,
      label: node.Label,
      topic: node.Topic,
      engagement: node.TotalEngagement,
      civility: node.AverageCivility,
      postCount: node.PostCount
    }));

    // Prepare edge data
    const links = filteredData.edges.map(edge => ({
      source: edge.Source,
      target: edge.Target,
      weight: edge.Weight,
      engagementSum: edge.EngagementSum
    }));

    // Find the most engaged node for center positioning
    const maxEngagementNode = nodes.reduce((max, node) => 
      node.engagement > max.engagement ? node : max, nodes[0]);

    // Create scales
    const maxEngagement = d3.max(nodes, d => d.engagement);
    const minEngagement = d3.min(nodes, d => d.engagement);
    
    // Font size scale based on engagement
    const fontSize = d3.scaleLinear()
      .domain([minEngagement, maxEngagement])
      .range([12, 36]);

    // Node radius scale
    const nodeRadius = d3.scaleLinear()
      .domain([minEngagement, maxEngagement])
      .range([15, 60]);

    // Civility color scale (similar to TopVisualization)
    const civilityColorScale = d3.scaleLinear()
      .domain([0, 0.15, 0.35, 0.55, 0.75, 1])
      .range(['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#16a34a', '#059669']);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id(d => d.id)
        .distance(d => Math.max(50, 200 - d.weight * 10))
        .strength(d => Math.min(1, d.weight / 10))
      )
      .force("charge", d3.forceManyBody()
        .strength(d => -Math.max(300, d.engagement / 100))
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide()
        .radius(d => nodeRadius(d.engagement) + 5)
      );

    // Position the highest engagement node at center
    if (maxEngagementNode) {
      maxEngagementNode.fx = width / 2;
      maxEngagementNode.fy = height / 2;
    }

    // Create background density field for civility shading
    const gridSize = 50;
    const densityData = new Array(gridSize * gridSize);
    
    // Initialize density grid
    for (let i = 0; i < gridSize * gridSize; i++) {
      densityData[i] = { civility: 0.5, density: 0 };
    }

    // Update density field based on node positions (will be updated during simulation)
    const updateDensityField = () => {
      // Reset density
      for (let i = 0; i < gridSize * gridSize; i++) {
        densityData[i] = { civility: 0, density: 0, totalWeight: 0 };
      }

      // Calculate density from nodes
      nodes.forEach(node => {
        if (!node.x || !node.y) return;
        
        const gridX = Math.floor((node.x / width) * gridSize);
        const gridY = Math.floor((node.y / height) * gridSize);
        
        // Add influence to surrounding grid cells
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const gx = gridX + dx;
            const gy = gridY + dy;
            
            if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              const weight = Math.exp(-distance / 2) * (node.engagement / maxEngagement);
              const index = gx + gy * gridSize;
              
              densityData[index].civility += weight * node.civility;
              densityData[index].density += weight;
              densityData[index].totalWeight += weight;
            }
          }
        }
      });

      // Normalize civility values
      densityData.forEach(cell => {
        if (cell.totalWeight > 0) {
          cell.civility = cell.civility / cell.totalWeight;
        } else {
          cell.civility = 0.5; // Default neutral civility
        }
      });
    };

    // Create civility background using contours
    const civilityBackground = g.append("g").attr("class", "civility-background");

    const updateCivilityBackground = () => {
      updateDensityField();
      
      // Clear previous contours
      civilityBackground.selectAll("*").remove();
      
      // Create contours for different civility levels
      const civilityThresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      
      civilityThresholds.forEach(threshold => {
        const contours = d3.contours()
          .size([gridSize, gridSize])
          .thresholds([threshold])(densityData.map(d => d.civility));
        
        civilityBackground.selectAll(`.civility-${Math.floor(threshold * 10)}`)
          .data(contours)
          .enter()
          .append("path")
          .attr("class", `civility-${Math.floor(threshold * 10)}`)
          .attr("d", d3.geoPath())
          .style("fill", civilityColorScale(threshold))
          .style("opacity", 0.3)
          .style("stroke", "none")
          .attr("transform", `scale(${width / gridSize}, ${height / gridSize})`);
      });
    };

    // Create links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .style("stroke", "#999")
      .style("stroke-opacity", 0.6)
      .style("stroke-width", d => Math.sqrt(d.weight));

    // Create nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add node circles
    node.append("circle")
      .attr("r", d => nodeRadius(d.engagement))
      .style("fill", d => colorMap[d.topic]?.color || '#666')
      .style("stroke", d => civilityColorScale(d.civility))
      .style("stroke-width", 3)
      .style("opacity", 0.8);

    // Add node labels
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", d => `${fontSize(d.engagement)}px`)
      .style("font-weight", "bold")
      .style("fill", "#ffffff")
      .style("text-shadow", "2px 2px 4px rgba(0,0,0,0.8)")
      .style("pointer-events", "none")
      .text(d => d.label);

    // Add hover interactions
    node
      .on("mouseover", function(event, d) {
        setHoveredNode(d);
        d3.select(this).select("circle").style("stroke-width", 5);
        d3.select(this).select("text").style("font-size", `${fontSize(d.engagement) + 2}px`);
      })
      .on("mouseout", function(event, d) {
        setHoveredNode(null);
        d3.select(this).select("circle").style("stroke-width", 3);
        d3.select(this).select("text").style("font-size", `${fontSize(d.engagement)}px`);
      });

    // Simulation tick function
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Update civility background periodically during simulation
    let tickCount = 0;
    const originalTick = simulation.on("tick");
    simulation.on("tick", function() {
      originalTick.call(this);
      tickCount++;
      if (tickCount % 10 === 0) { // Update every 10 ticks for performance
        updateCivilityBackground();
      }
    });

    // Final update when simulation ends
    simulation.on("end", updateCivilityBackground);

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      if (d !== maxEngagementNode) { // Don't unfix the center node
        d.fx = null;
        d.fy = null;
      }
    }

    // Add legend (positioned outside the zoomable area)
    const legend = svg.append("g")
      .attr("transform", `translate(${dimensions.width - 120}, ${margin.top})`);

    legend.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text("Civility Levels");

    const legendData = [
      { color: "#059669", label: "Very High", range: "0.75-1.0" },
      { color: "#16a34a", label: "High", range: "0.55-0.75" },
      { color: "#eab308", label: "Medium", range: "0.35-0.55" },
      { color: "#f59e0b", label: "Low-Medium", range: "0.15-0.35" },
      { color: "#ea580c", label: "Low", range: "0.05-0.15" },
      { color: "#dc2626", label: "Very Low", range: "0.0-0.05" }
    ];

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
      .style("stroke-width", 1);

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 20)
      .attr("y", (d, i) => i * 25 + 12)
      .style("font-size", "11px")
      .style("fill", "#333")
      .text(d => d.label);

    // Cleanup function
    return () => {
      simulation.stop();
    };

  }, [dimensions, filteredData, loading]);

  // Mock data generators for fallback
  const generateMockNodes = () => [
    { Id: "justice", Label: "Justice", Topic: "blacklivesmatter", TotalEngagement: 15600, AverageCivility: 0.92, PostCount: 85 },
    { Id: "equality", Label: "Equality", Topic: "blacklivesmatter", TotalEngagement: 13400, AverageCivility: 0.87, PostCount: 72 },
    { Id: "george-floyd", Label: "George Floyd", Topic: "blacklivesmatter", TotalEngagement: 18900, AverageCivility: 0.6, PostCount: 91 },
    { Id: "protest", Label: "Protest", Topic: "blacklivesmatter", TotalEngagement: 16700, AverageCivility: 0.55, PostCount: 78 },
    { Id: "riots", Label: "Riots", Topic: "blacklivesmatter", TotalEngagement: 2800, AverageCivility: 0.12, PostCount: 45 },
    { Id: "violence", Label: "Violence", Topic: "blacklivesmatter", TotalEngagement: 2100, AverageCivility: 0.08, PostCount: 32 },
    { Id: "climate", Label: "Climate Change", Topic: "climate", TotalEngagement: 12000, AverageCivility: 0.75, PostCount: 65 },
    { Id: "gun-rights", Label: "Gun Rights", Topic: "gun", TotalEngagement: 9800, AverageCivility: 0.45, PostCount: 58 }
  ];

  const generateMockEdges = () => [
    { Source: "justice", Target: "equality", Weight: 8, EngagementSum: 1200 },
    { Source: "george-floyd", Target: "protest", Weight: 6, EngagementSum: 980 },
    { Source: "protest", Target: "riots", Weight: 3, EngagementSum: 450 },
    { Source: "riots", Target: "violence", Weight: 5, EngagementSum: 320 },
    { Source: "justice", Target: "george-floyd", Weight: 7, EngagementSum: 1100 },
    { Source: "equality", Target: "protest", Weight: 4, EngagementSum: 650 }
  ];

  const generateMockPosts = () => [];

  if (loading) {
    return (
      <div className="flex flex-col w-full h-full p-2">
        <SectionTitle
          icon={<FaProjectDiagram />}
          text="Network Graph"
          helpContent="Loading network data..."
        />
        <div className="card shadow-md bg-base-300 flex-1 flex items-center justify-center">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-2">
      <SectionTitle
        icon={<FaProjectDiagram />}
        text="Keyword Network Graph"
        helpContent={
          <div className="text-left">
            <p>Interactive network visualization of keyword relationships and civility patterns.</p>
            <p>Features:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><span className="font-semibold">Central Focus:</span> Most engaged keyword anchored at center</li>
              <li><span className="font-semibold">Node Size:</span> Proportional to total engagement</li>
              <li><span className="font-semibold">Node Color:</span> Topic-based coloring from utils.js</li>
              <li><span className="font-semibold">Border Color:</span> Civility level (red=low, green=high)</li>
              <li><span className="font-semibold">Background Shading:</span> Regional civility density</li>
              <li><span className="font-semibold">Connections:</span> Keyword co-occurrence relationships</li>
            </ul>
            <p className="mt-2">Drag nodes to explore relationships. Hover for detailed metrics.</p>
          </div>
        }
      />
      <div className="card shadow-md bg-base-300 flex-1 overflow-hidden">
        <div className="card-body p-2 flex flex-col h-full">
          {/* Debug info */}
          <div className="text-xs text-gray-500 mb-2">
            Nodes: {filteredData.nodes.length} | Edges: {filteredData.edges.length} | 
            Dimensions: {dimensions.width}x{dimensions.height} | Loading: {loading.toString()}
          </div>
          
          {hoveredNode && (
            <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 border">
              <div className="font-bold text-lg">{hoveredNode.label}</div>
              <div className="text-sm text-gray-600">
                Topic: {topicNames[hoveredNode.topic] || hoveredNode.topic}
              </div>
              <div className="text-sm text-gray-600">
                Engagement: {hoveredNode.engagement.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                Civility: {(hoveredNode.civility * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">
                Posts: {hoveredNode.postCount}
              </div>
            </div>
          )}
          
          {!loading && filteredData.nodes.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-lg font-semibold">No data available</div>
                <div className="text-sm">Check console for loading errors</div>
              </div>
            </div>
          )}
          
          <div ref={containerRef} className="w-full flex-1 overflow-hidden" style={{ minHeight: "500px", maxHeight: "100%" }} />
        </div>
      </div>
    </div>
  );
}

NetworkGraph.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string),
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  legislator: PropTypes.object,
  keyword: PropTypes.string
};
