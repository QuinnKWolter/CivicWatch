import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { networkData } from '../utils/mockData'
import { Box, Typography, Grid, Button, Checkbox, FormControlLabel, Select, MenuItem, Slider } from '@mui/material'

function InteractionNetwork() {
  const chartRef = useRef()
  const [selectedLegislator, setSelectedLegislator] = useState(null)
  const [hoveredChord, setHoveredChord] = useState(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [filters, setFilters] = useState({
    interactionType: 'all',
    party: ['D', 'R'],
    state: 'all'
  })
  const [minCivility, setMinCivility] = useState(0.5)
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    civility: true,
    misinformation: true,
    statistics: true
  });

  // Filter handlers
  const handleFilterChange = (type, value) => {
    setFilters(prev => ({ ...prev, [type]: value }))
  }

  const handleMouseMove = (event) => {
    const container = chartRef.current.getBoundingClientRect()
    const x = event.clientX - container.left
    const y = event.clientY - container.top
    setMousePosition({ x, y })
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    const container = chartRef.current;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const margin = 100;
    const radius = Math.min(width, height) / 2 - margin;

    // Ensure radius is not negative
    if (radius < 0) {
      console.error("Invalid radius: ", radius);
      return;
    }

    // Clear previous SVG
    d3.select(chartRef.current).selectAll("*").remove()

    // Create SVG
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width/2},${height/2})`)

    // Filter nodes based on current filters
    const filteredNodes = networkData.nodes.filter(node => 
      filters.party.includes(node.party) &&
      (filters.state === 'all' || node.state === filters.state)
    )

    // Create matrix for chord diagram
    const n = filteredNodes.length
    const matrix = Array(n).fill().map(() => Array(n).fill(0))

    // Fill matrix with interaction values
    networkData.links.forEach(link => {
      const sourceIndex = filteredNodes.findIndex(node => node.id === link.source)
      const targetIndex = filteredNodes.findIndex(node => node.id === link.target)
      if (sourceIndex !== -1 && targetIndex !== -1) {
        // Use totalInteractions or specific type based on filter
        const sourceToTarget = filters.interactionType === 'all' 
          ? link.sourceToTarget.total
          : link.sourceToTarget[filters.interactionType]
        const targetToSource = filters.interactionType === 'all'
          ? link.targetToSource.total
          : link.targetToSource[filters.interactionType]
        
        matrix[sourceIndex][targetIndex] = sourceToTarget
        matrix[targetIndex][sourceIndex] = targetToSource
      }
    })

    // Create chord layout
    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending)(matrix)

    // Color scale
    const color = d3.scaleOrdinal()
      .domain(['D', 'R'])
      .range(['#60A5FA', '#EF4444'])

    // Create groups
    const group = svg.append("g")
      .selectAll("g")
      .data(chord.groups)
      .join("g")

    // Add arcs for each group
    const arc = d3.arc()
      .innerRadius(radius)
      .outerRadius(radius + 20)

    group.append("path")
      .attr("fill", d => color(filteredNodes[d.index].party))
      .attr("d", arc)
      .on("mouseover", (event, d) => {
        setSelectedLegislator(filteredNodes[d.index])
      })
      .on("mouseout", () => {
        setSelectedLegislator(null)
      })

    // Add labels
    group.append("text")
      .each(d => { d.angle = (d.startAngle + d.endAngle) / 2 })
      .attr("dy", ".35em")
      .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${radius + 40})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
      .text(d => filteredNodes[d.index].name)
      .style("fill", "#E5E7EB")
      .style("font-size", "12px")

    // Add chords
    const ribbon = d3.ribbon()
      .radius(radius)

    svg.append("g")
      .attr("fill-opacity", 0.67)
      .selectAll("path")
      .data(chord)
      .join("path")
      .attr("d", ribbon)
      .attr("fill", d => color(filteredNodes[d.source.index].party))
      .attr("stroke", d => d3.rgb(color(filteredNodes[d.source.index].party)).darker())
      .on("mouseover", (event, d) => {
        const sourceNode = filteredNodes[d.source.index]
        const targetNode = filteredNodes[d.target.index]
        const link = networkData.links.find(l => 
          (l.source === sourceNode.id && l.target === targetNode.id) ||
          (l.source === targetNode.id && l.target === sourceNode.id)
        )
        
        if (link) {
          const interactions = link.source === sourceNode.id
            ? { forward: link.sourceToTarget, reverse: link.targetToSource }
            : { forward: link.targetToSource, reverse: link.sourceToTarget }
          
          setHoveredChord({ 
            sourceNode, 
            targetNode, 
            interactions: {
              forward: {
                mentions: interactions.forward.mentions.count,
                replies: interactions.forward.replies.count,
                retweets: interactions.forward.retweets.count,
                total: interactions.forward.total
              },
              reverse: {
                mentions: interactions.reverse.mentions.count,
                replies: interactions.reverse.replies.count,
                retweets: interactions.reverse.retweets.count,
                total: interactions.reverse.total
              }
            }
          })
        }
      })
      .on("mouseout", () => {
        setHoveredChord(null)
      })

    // Add event listener for mouse movement
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [filters])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexGrow: 1 }}>
        <div ref={chartRef} style={{ height: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible' }} />
        
        {hoveredChord && (
          <Box
            sx={{
              position: 'absolute',
              left: mousePosition.x + 20,
              top: mousePosition.y,
              pointerEvents: 'auto',
              bgcolor: 'grey.900',
              border: 1,
              borderColor: 'grey.600',
              borderRadius: 1,
              boxShadow: 3,
              p: 2,
              width: 300,
              zIndex: 50
            }}
            onMouseEnter={() => setHoveredChord(hoveredChord)}
            onMouseLeave={() => setHoveredChord(null)}
          >
            <Typography variant="h6" color="textPrimary" gutterBottom>
              Interaction Details
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {hoveredChord.sourceNode.name} → {hoveredChord.targetNode.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Mentions: {hoveredChord.interactions.forward.mentions}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Replies: {hoveredChord.interactions.forward.replies}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Retweets: {hoveredChord.interactions.forward.retweets}
            </Typography>
            <Typography variant="body2" color="textSecondary" fontWeight="fontWeightBold">
              Total: {hoveredChord.interactions.forward.total}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default InteractionNetwork