import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { legislatorData } from '../utils/mockData'
import { Box, Typography } from '@mui/material'

function LegislatorProfile() {
  const chartRef = useRef()

  useEffect(() => {
    const container = chartRef.current
    const width = container.offsetWidth
    const height = container.offsetHeight
    const radius = Math.min(width, height) / 2 - 60

    // Ensure radius is not negative
    if (radius < 0) {
      console.error("Invalid radius: ", radius)
      return
    }

    // Clear any existing SVG
    d3.select(container).selectAll("*").remove()

    // Create SVG
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "transparent")
      .append("g")
      .attr("transform", `translate(${width/2},${height/2})`)

    // Scale for radius
    const rScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, radius])

    // Angle scale
    const aScale = d3.scaleLinear()
      .domain([0, legislatorData.radar.labels.length])
      .range([0, 2 * Math.PI])

    // Draw the circles
    const circles = [20, 40, 60, 80, 100]
    circles.forEach(circle => {
      svg.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", rScale(circle))
        .attr("fill", "none")
        .attr("stroke", "#4B5563")
        .attr("opacity", 0.4)
    })

    // Create the points
    const points = legislatorData.radar.labels.map((label, i) => {
      const angle = aScale(i)
      return {
        x: rScale(legislatorData.radar.values[i]) * Math.cos(angle - Math.PI/2),
        y: rScale(legislatorData.radar.values[i]) * Math.sin(angle - Math.PI/2),
        label: label,
        value: legislatorData.radar.values[i]
      }
    })

    // Draw the shape
    const line = d3.lineRadial()
      .angle((d, i) => aScale(i))
      .radius(d => rScale(d))
      .curve(d3.curveLinearClosed)

    svg.append("path")
      .datum(legislatorData.radar.values)
      .attr("d", line)
      .attr("fill", "rgba(59, 130, 246, 0.2)")
      .attr("stroke", "#60A5FA")
      .attr("stroke-width", 2)

    // Add labels
    points.forEach((point, i) => {
      svg.append("text")
        .attr("x", point.x * 1.3)
        .attr("y", point.y * 1.3)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .text(legislatorData.radar.labels[i])
        .style("font-size", "14px")
        .style("fill", "#E5E7EB")
    })
  }, [])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ bgcolor: 'grey.800', p: 2, borderRadius: 1, flexGrow: 1 }}>
        <div ref={chartRef} style={{ height: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible' }} />
      </Box>
    </Box>
  )
}

export default LegislatorProfile