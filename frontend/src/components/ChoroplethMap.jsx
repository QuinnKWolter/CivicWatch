import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { Tooltip } from 'recharts';

// Map of state abbreviations to full names
const stateAbbrevToName = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const ChoroplethMap = ({ startDate, endDate, activeTopics }) => {
  const svgRef = useRef();
  const [geojson, setGeojson] = useState(null);
  const [engagementData, setEngagementData] = useState([]);


  useEffect(() => {
    fetch('./us-states.json')
      .then(response => response.json())
      .then(data => {
        setGeojson(topojson.feature(data, data.objects.states));
      })
      .catch(error => console.error('Error loading GeoJSON:', error));
  }, []);

 
  useEffect(() => {
    if (!startDate || !endDate || !activeTopics || activeTopics.length === 0) return;

    const formattedStart = startDate.format('YYYY-MM-DD');
    const formattedEnd = endDate.format('YYYY-MM-DD');
    const topicsParam = activeTopics.map(topic => `topic=${topic}`).join('&');

    console.log('Active topics:', activeTopics);
    const url = `http://127.0.0.1:8000/api/geo/activity/posts/?start_date=${formattedStart}&end_date=${formattedEnd}&${topicsParam}&metric=posts`;
    console.log('Fetching from URL:', url);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(item => ({
          state: stateAbbrevToName[item.state],
          total_engagement: item.total
        }));
        setEngagementData(formatted);
      })
      .catch(err => console.error('Failed to fetch API data:', err));
  }, [startDate, endDate, activeTopics]);

  
  useEffect(() => {
    if (!geojson || engagementData.length === 0) return;

    const stateEngagementMap = new Map();
    engagementData.forEach(entry => {
      stateEngagementMap.set(entry.state, entry);
    });

    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('viewBox', '0 0 960 600')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const width = svg.node().getBoundingClientRect().width;
    const height = width * (600 / 960);
    svg.attr('height', height);

 
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background', '#333')
      .style('padding', '8px')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('font-size', '14px')
      .style('font-family', 'sans-serif')
      .style('z-index', 10)
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.2)');

    const path = d3.geoPath(d3.geoAlbersUsa().scale(1300).translate([487.5, 305]));

    const mockData = new Map();
    geojson.features.forEach((d) => {
      const stateName = d.properties.name;
      const stateData = stateEngagementMap.get(stateName);
      if (stateData) {
        mockData.set(d.id, stateData);
      }
    });

    const color = d3.scaleLinear()
      .domain([0, d3.max(engagementData, d => d.total_engagement)])
      .range(['#e5f5e0', '#31a354']);

    svg.selectAll('path').remove();
    svg.selectAll('g.legend').remove();
    svg.select('defs').remove();

    svg.append('g')
        .selectAll('path')
        .data(geojson.features)
        .join('path')
        .attr('d', path)
        .attr('fill', d => {
          const stateData = mockData.get(d.id);
          return stateData ? color(stateData.total_engagement) : '#f0f0f0';
        })
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5)
        .on('mouseover', (event, d) => {
          const stateName = d.properties.name;
          const stateData = stateEngagementMap.get(stateName);
          if (stateData) {
            tooltip.transition().duration(200).style('opacity', 0.9);
            tooltip.style('color', '#98fb98')
            tooltip.html(`<strong>${stateName}</strong><br>Total: ${stateData.total_engagement.toLocaleString()}`);
          }
        })
        .on('mousemove', (event) => {
          tooltip.style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 28}px`);
        })
        .on('mouseout', () => {
          tooltip.transition().duration(500).style('opacity', 0);
        });

    const legendSize = 60;
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - legendSize * 3 - 20},${height - legendSize * 3 - 20})`);

    const x = d3.scaleLinear()
      .domain([0, d3.max(engagementData, d => d.total_engagement)])
      .range([0, legendSize * 3]);

    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%')
      .selectAll('stop')
      .data([
        { offset: '0%', color: '#e5f5e0' },
        { offset: '100%', color: '#31a354' }
      ])
      .enter().append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);
  }, [geojson, engagementData]);

  return <svg ref={svgRef}></svg>;
};

export default ChoroplethMap;