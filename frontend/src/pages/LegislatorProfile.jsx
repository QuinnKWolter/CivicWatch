import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { legislatorData } from '../utils/mockData'

function LegislatorProfile() {
  const chartRef = useRef()

  useEffect(() => {
    const data = legislatorData.radar
    const width = 600
    const height = 600
    const radius = Math.min(width, height) / 2 - 60

    // Clear any existing SVG
    d3.select(chartRef.current).selectAll("*").remove()

    // Create SVG
    const svg = d3.select(chartRef.current)
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
      .domain([0, data.labels.length])
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
    const points = data.labels.map((label, i) => {
      const angle = aScale(i)
      return {
        x: rScale(data.values[i]) * Math.cos(angle - Math.PI/2),
        y: rScale(data.values[i]) * Math.sin(angle - Math.PI/2),
        label: label,
        value: data.values[i]
      }
    })

    // Draw the shape
    const line = d3.lineRadial()
      .angle((d, i) => aScale(i))
      .radius(d => rScale(d))
      .curve(d3.curveLinearClosed)

    svg.append("path")
      .datum(data.values)
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
        .text(data.labels[i])
        .style("font-size", "14px")
        .style("fill", "#E5E7EB")
    })
  }, [])

  return (
    <div className="h-full">
      <h1 className="text-xl font-bold text-gray-100 mb-2">
        Legislator Profile
      </h1>
      <div className="bg-gray-800 rounded-lg p-4 h-[calc(100%-2rem)]">
        <div ref={chartRef} className="h-full flex justify-center overflow-visible" />
      </div>
    </div>
  )
}

export default LegislatorProfile