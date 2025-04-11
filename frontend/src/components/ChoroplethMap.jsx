
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

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

const ChoroplethMap = ({ startDate, endDate, activeTopics, selectedMetric }) => {
  const svgRef = useRef();
  const [geojson, setGeojson] = useState(null);
  const [engagementData, setEngagementData] = useState([]);

  useEffect(() => {
    fetch('./us-states.json')
      .then(res => res.json())
      .then(data => {
        const states = topojson.feature(data, data.objects.states);
        setGeojson(states);
      })
      .catch(err => console.error('Error loading GeoJSON:', err));
  }, []);

  useEffect(() => {
    if (!startDate || !endDate || !activeTopics || activeTopics.length === 0) return;

    const formattedStart = startDate.format('YYYY-MM-DD');
    const formattedEnd = endDate.format('YYYY-MM-DD');
    const topicsParam = activeTopics.map(topic => `topic=${topic}`).join('&');

    const url = `http://127.0.0.1:8000/api/geo/activity/topics/?start_date=${formattedStart}&end_date=${formattedEnd}&${topicsParam}&metric=${selectedMetric}`;
    console.log('Fetching from:', url);

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(item => ({
          state: stateAbbrevToName[item.state] ?? item.state,
          total_engagement:
            selectedMetric === 'posts' ? item.total :
            selectedMetric === 'legislators' ? item.legislator_count :
            selectedMetric === 'engagement' ? item.total || 0 : 0,
          party: item.party,
          metric: selectedMetric
        }));
        setEngagementData(formatted);
      })
      .catch(err => console.error('Error fetching engagement data:', err));
  }, [startDate, endDate, activeTopics, selectedMetric]);

  useEffect(() => {
    if (!geojson || engagementData.length === 0) return;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', '0 0 960 600')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg.selectAll('*').remove();

    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '6px')
      .style('background', '#fff')
      .style('color', 'green')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('font-size', '14px')
      .style('opacity', 0);

    const path = d3.geoPath(d3.geoAlbersUsa().scale(1300).translate([487.5, 305]));

    const stateEngagementMap = new Map();
    engagementData.forEach(d => stateEngagementMap.set(d.state, d));

    const republicanData = engagementData.filter(d => d.party === 'R');
    const democratData = engagementData.filter(d => d.party === 'D');

    const redScale = d3.scaleLinear()
      .domain([0, d3.max(republicanData, d => d.total_engagement) || 1])
      .range(['#f4cccc', '#cc0000']);

    const blueScale = d3.scaleLinear()
      .domain([0, d3.max(democratData, d => d.total_engagement) || 1])
      .range(['#add8e6', '#1e3a8a']);

    svg.append('g')
      .selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('d', path)
      .attr('fill', d => {
        const stateData = stateEngagementMap.get(d.properties.name);
        if (!stateData || stateData.total_engagement === 0) return '#ffffff';
        if (stateData.party === 'R') return redScale(stateData.total_engagement);
        if (stateData.party === 'D') return blueScale(stateData.total_engagement);
        return '#ffffff';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mouseover', (event, d) => {
        const stateName = d.properties.name;
        const stateData = stateEngagementMap.get(stateName);
        if (stateData && stateData.total_engagement !== undefined) {
          tooltip.transition().duration(200).style('opacity', 0.9);
          const metricLabel = stateData.metric === 'posts' ? 'Posts' :
                              stateData.metric === 'legislators' ? 'Legislators' :
                              stateData.metric === 'engagement' ? 'Engagement' : '';
          tooltip.html(`<strong>${stateName}</strong><br>${metricLabel}: ${stateData.total_engagement.toLocaleString()}`);
        }
      })
      .on('mousemove', event => {
        tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY - 28}px`);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(300).style('opacity', 0);
      });

    return () => tooltip.remove();
  }, [geojson, engagementData]);

  return <svg ref={svgRef} style={{ width: '100%' }} />;
};

export default ChoroplethMap;
