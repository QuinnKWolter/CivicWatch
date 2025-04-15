import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { FaSpinner } from 'react-icons/fa';

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

function GeographyCharts({ startDate, endDate, selectedTopics, selectedMetric }) {
  const svgRef = useRef();
  const [geojson, setGeojson] = useState(null);
  const [engagementData, setEngagementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    if (!startDate || !endDate || !selectedTopics || selectedTopics.length === 0) return;

    const formattedStart = startDate.format('YYYY-MM-DD');
    const formattedEnd = endDate.format('YYYY-MM-DD');
    const topicsParam = `topics=${selectedTopics.join(',')}`;
    const url = `http://127.0.0.1:8000/api/geo/activity/topics/?start_date=${formattedStart}&end_date=${formattedEnd}&${topicsParam}&metric=${selectedMetric}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        console.log(data);
        const formatted = data.map(item => ({
          state: stateAbbrevToName[item.state] ?? item.state,
          republicanTotal: item.Republican || 0,
          democratTotal: item.Democratic || 0,
          total_engagement: item.total || 0,
        }));
        setEngagementData(formatted);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching engagement data:', err);
        setError("Failed to load geography data. Please try again.");
        setLoading(false);
      });
  }, [startDate, endDate, selectedTopics, selectedMetric]);

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
      .style('color', 'black')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('font-size', '14px')
      .style('opacity', 0);

    const path = d3.geoPath(d3.geoAlbersUsa().scale(1300).translate([487.5, 305]));

    const stateEngagementMap = new Map();
    engagementData.forEach(d => stateEngagementMap.set(d.state, d));

    const redScale = d3.scaleLinear()
      .domain([0, d3.max(engagementData, d => d.republicanTotal)])
      .range(['#f4cccc', '#cc0000']); 

    const blueScale = d3.scaleLinear()
      .domain([0, d3.max(engagementData, d => d.democratTotal)])
      .range(['#add8e6', '#1e3a8a']);  

    svg.append('g')
      .selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('d', path)
      .attr('fill', d => {
        const stateData = stateEngagementMap.get(d.properties.name);
        if (!stateData) return '#ffffff';

        const republicanTotal = stateData.republicanTotal;
        const democratTotal = stateData.democratTotal;

        if (republicanTotal > democratTotal) {
          return redScale(republicanTotal);
        } else if (democratTotal > republicanTotal) {
          return blueScale(democratTotal); 
        }

        return d3.interpolateRgb(redScale(republicanTotal), blueScale(democratTotal))(0.5);
      })
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5)
      .on('mouseover', (event, d) => {
        const stateName = d.properties.name;
        const stateData = stateEngagementMap.get(stateName);
      
        if (stateData) {
          tooltip.transition().duration(200).style('opacity', 0.9);
      
          const total = stateData.total_engagement; // Total engagement for the selected metric
          const metricLabel = selectedMetric === 'posts' ? 'posts' :
                              selectedMetric === 'legislators' ? 'legislators' :
                              selectedMetric === 'engagement' ? 'engagements' : 'records';
      
          const formattedStart = startDate.format('YYYY-MM-DD');
          const formattedEnd = endDate.format('YYYY-MM-DD');
          const topicsList = selectedMetric === 'posts' ? (selectedTopics.join(', ') || 'No topic selected') : '';
      
          let tooltipHtml = `<strong>${stateName}</strong><br>`;
          tooltipHtml += `${total.toLocaleString()} ${metricLabel}`; 
          tooltipHtml += `<br>from ${formattedStart} to ${formattedEnd}`; 
          if (topicsList) {
            tooltipHtml += `<br><strong>Topics:</strong> ${topicsList}`; 
          }
      
          tooltip.html(tooltipHtml);
        }
      })
      
      .on('mousemove', event => {
        tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY - 28}px`);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(300).style('opacity', 0);
      });

    return () => tooltip.remove();
  }, [geojson, engagementData, selectedMetric]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading geography data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <>
      <svg ref={svgRef} style={{ width: '100%' }} />
      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '10px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#cc0000', marginRight: '6px' }}></div>
          <span>Republican</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#1e3a8a', marginRight: '6px' }}></div>
          <span>Democrat</span>
        </div>
      </div>
    </>
  );
}

export default GeographyCharts; 