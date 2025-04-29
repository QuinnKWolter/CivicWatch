import '../../App.css';
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

function ChoroplethMap({ startDate, endDate, selectedTopics, selectedMetric }) {
  const svgRef = useRef();
  const [geojson, setGeojson] = useState(null);
  const [engagementData, setEngagementData] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
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
        const formatted = data.map(item => ({
          state: stateAbbrevToName[item.state] ?? item.state,
          republicanTotal: item.Republican || 0,
          democratTotal: item.Democratic || 0,
          total_engagement: item.total || 0,
          topic_breakdown: item.topic_breakdown || {},
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
      .style('pointer-events', 'none')
      .style('background', '#e0f7fa')
      .style('color', 'black')
      .style('border', '1px solid #ccc')
      .style('padding', '10px')
      .style('font-size', '14px')
      .style('border-radius', '6px')
      .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
      .style('opacity', 0)
      .style('z-index', 9999);

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

        const { republicanTotal, democratTotal } = stateData;
        if (republicanTotal > democratTotal) return redScale(republicanTotal);
        if (democratTotal > republicanTotal) return blueScale(democratTotal);

        return d3.interpolateRgb(redScale(republicanTotal), blueScale(democratTotal))(0.5);
      })
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5)
      .on('mousemove', function (event, d) {
        const [x, y] = d3.pointer(event);
        const stateName = d.properties.name;

        const stateData = stateEngagementMap.get(stateName);
        if (!stateData) return;

        const tooltipHtml = `
          <strong>${stateName}</strong><br/>
           <strong>Total:</strong> ${formatNumber(stateData.total_engagement)}<br/>
          <strong>From date:</strong> ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}<br/>
          <strong>On topics:</strong> ${selectedTopics.join(', ') || 'All topics'}<br/>
          With <strong>Democrats:</strong> ${formatNumber(stateData.democratTotal)}<br/>
          And <strong>Republicans:</strong> ${formatNumber(stateData.republicanTotal)}<br/>
        `;

        tooltip
          .html(tooltipHtml)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`)
          .transition().duration(100)
          .style("opacity", 0.95);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .on('click', (event, d) => {
        const stateName = d.properties.name;
        const stateData = stateEngagementMap.get(stateName);
        if (stateData) {
          setSelectedState({
            name: stateName,
            topicBreakdown: stateData.topic_breakdown,
          });
        }
      });

    return () => tooltip.remove();
  }, [geojson, engagementData, selectedMetric]);

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

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
          <div style={{ width: '20px', height: '20px', backgroundColor: '#1e3a8a', marginRight: '6px' }}></div>
          <span>Democrat</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#cc0000', marginRight: '6px' }}></div>
          <span>Republican</span>
        </div>
      </div>
    </>
  );
}

export default ChoroplethMap;
