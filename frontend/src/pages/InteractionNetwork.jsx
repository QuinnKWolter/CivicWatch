import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { networkData } from '../utils/mockData'

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
    // Get the container's position
    const container = chartRef.current.getBoundingClientRect()
    
    // Calculate position relative to the container
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
    // Clear previous SVG
    d3.select(chartRef.current).selectAll("*").remove()

    // Set up dimensions
    const width = 800
    const height = 800
    const margin = 100
    const radius = Math.min(width, height) / 2 - margin

    // Create SVG
    const svg = d3.select(chartRef.current)
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
    <div className="space-y-6 max-w-full">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">
            Legislative Interaction Network
          </h1>
          <p className="text-gray-400">
            Visualizing social media interactions between legislators
          </p>
        </div>
        <div className="space-x-2">
          <button 
            onClick={() => setFilters({
              interactionType: 'all',
              party: ['D', 'R'],
              state: 'all'
            })}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            Reset Filters
          </button>
          <button 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
          >
            Download SVG
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Sidebar - Controls */}
        <div className="col-span-3 space-y-4">
          {/* Basic Filters Section */}
          <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg">
            <button 
              className="w-full p-4 flex justify-between items-center text-gray-200 hover:bg-gray-600/50"
              onClick={() => toggleSection('filters')}
            >
              <span className="font-semibold">Basic Filters</span>
              <span className="transform transition-transform duration-200" style={{
                transform: expandedSections.filters ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>▼</span>
            </button>
            {expandedSections.filters && (
              <div className="p-4 border-t border-gray-600">
                {/* Existing filter controls */}
                <div className="space-y-4">
                  {/* Interaction Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Interaction Type
                    </label>
                    <select 
                      className="w-full bg-gray-600 text-gray-200 rounded-md p-2"
                      onChange={(e) => handleFilterChange('interactionType', e.target.value)}
                    >
                      <option value="all">All Interactions</option>
                      <option value="mentions">Mentions</option>
                      <option value="replies">Replies</option>
                      <option value="retweets">Retweets</option>
                    </select>
                  </div>

                  {/* Party Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Party
                    </label>
                    <div className="space-y-2">
                      {['D', 'R'].map(party => (
                        <label key={party} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.party.includes(party)}
                            onChange={(e) => {
                              const newParties = e.target.checked
                                ? [...filters.party, party]
                                : filters.party.filter(p => p !== party)
                              handleFilterChange('party', newParties)
                            }}
                            className="form-checkbox text-blue-500"
                          />
                          <span className="text-gray-300">
                            {party === 'D' ? 'Democrat' : 'Republican'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* State Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      State
                    </label>
                    <select 
                      className="w-full bg-gray-600 text-gray-200 rounded-md p-2"
                      onChange={(e) => handleFilterChange('state', e.target.value)}
                    >
                      <option value="all">All States</option>
                      {['CA', 'TX', 'NY', 'FL'].map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Civility Settings Section */}
          <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg">
            <button 
              className="w-full p-4 flex justify-between items-center text-gray-200 hover:bg-gray-600/50"
              onClick={() => toggleSection('civility')}
            >
              <span className="font-semibold">Civility Settings</span>
              <span className="transform transition-transform duration-200" style={{
                transform: expandedSections.civility ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>▼</span>
            </button>
            {expandedSections.civility && (
              <div className="p-4 border-t border-gray-600 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">
                    Minimum Civility Score
                  </label>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={minCivility}
                    onChange={(e) => setMinCivility(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300">
                    Visualization Style
                  </label>
                  <select 
                    className="w-full bg-gray-600 text-gray-200 rounded-md p-2 mt-1"
                  >
                    <option value="color">Color Gradient</option>
                    <option value="thickness">Line Thickness</option>
                    <option value="opacity">Opacity</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Misinformation Settings Section */}
          <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg">
            <button 
              className="w-full p-4 flex justify-between items-center text-gray-200 hover:bg-gray-600/50"
              onClick={() => toggleSection('misinformation')}
            >
              <span className="font-semibold">Misinformation Settings</span>
              <span className="transform transition-transform duration-200" style={{
                transform: expandedSections.misinformation ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>▼</span>
            </button>
            {expandedSections.misinformation && (
              <div className="p-4 border-t border-gray-600 space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="form-checkbox text-blue-500" />
                    <span className="text-gray-300">Show Misinformation Flags</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="form-checkbox text-blue-500" />
                    <span className="text-gray-300">Hide High-Risk Connections</span>
                  </label>
                </div>
                <div>
                  <label className="text-sm text-gray-300">Threshold</label>
                  <select className="w-full bg-gray-600 text-gray-200 rounded-md p-2 mt-1">
                    <option value="0">Any flags</option>
                    <option value="3">3+ flags</option>
                    <option value="5">5+ flags</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Visualization Area */}
        <div className="col-span-9">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 h-full">
            <div ref={chartRef} className="flex justify-center overflow-visible" />
            
            {/* Enhanced Hover Tooltip */}
            {hoveredChord && (
              <div 
                className="absolute z-50"
                style={{
                  left: `${mousePosition.x + 20}px`,
                  top: `${mousePosition.y}px`,
                  pointerEvents: 'auto'
                }}
                onMouseEnter={() => setHoveredChord(hoveredChord)}
                onMouseLeave={() => setHoveredChord(null)}
              >
                <div className="bg-gray-900/95 backdrop-blur-md border border-gray-600 rounded-lg shadow-xl p-4 w-72">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="text-gray-200 font-semibold border-b border-gray-600 pb-2">
                      Interaction Details
                    </div>
                    
                    {/* Forward Interactions */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-blue-400">{hoveredChord.sourceNode.name}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-blue-400">{hoveredChord.targetNode.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-4">
                        <div className="text-gray-400">Mentions:</div>
                        <div className="text-gray-200">{hoveredChord.interactions.forward.mentions}</div>
                        <div className="text-gray-400">Replies:</div>
                        <div className="text-gray-200">{hoveredChord.interactions.forward.replies}</div>
                        <div className="text-gray-400">Retweets:</div>
                        <div className="text-gray-200">{hoveredChord.interactions.forward.retweets}</div>
                        <div className="text-gray-400 font-medium">Total:</div>
                        <div className="text-gray-200 font-medium">{hoveredChord.interactions.forward.total}</div>
                      </div>
                    </div>

                    {/* Reverse Interactions */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-blue-400">{hoveredChord.targetNode.name}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-blue-400">{hoveredChord.sourceNode.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-4">
                        <div className="text-gray-400">Mentions:</div>
                        <div className="text-gray-200">{hoveredChord.interactions.reverse.mentions}</div>
                        <div className="text-gray-400">Replies:</div>
                        <div className="text-gray-200">{hoveredChord.interactions.reverse.replies}</div>
                        <div className="text-gray-400">Retweets:</div>
                        <div className="text-gray-200">{hoveredChord.interactions.reverse.retweets}</div>
                        <div className="text-gray-400 font-medium">Total:</div>
                        <div className="text-gray-200 font-medium">{hoveredChord.interactions.reverse.total}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg p-4">
        <button 
          className="w-full flex justify-between items-center text-gray-200 hover:bg-gray-600/50"
          onClick={() => toggleSection('statistics')}
        >
          <span className="font-semibold">Statistics & Legend</span>
          <span className="transform transition-transform duration-200" style={{
            transform: expandedSections.statistics ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>▼</span>
        </button>
        {expandedSections.statistics && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <h4 className="text-gray-200 font-semibold mb-2">Civility Scale</h4>
              <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
              <div className="flex justify-between text-sm text-gray-400 mt-1">
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
              </div>
            </div>
            <div>
              <h4 className="text-gray-200 font-semibold mb-2">Network Stats</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Average Civility: 0.82</p>
                <p>Total Misinformation Flags: 24</p>
                <p>High-Risk Connections: 3</p>
              </div>
            </div>
            <div>
              <h4 className="text-gray-200 font-semibold mb-2">Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-400" />
                  <span className="text-gray-300">Democrat</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-400" />
                  <span className="text-gray-300">Republican</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InteractionNetwork