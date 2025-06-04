import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import PropTypes from 'prop-types';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

function ChoroplethMap({
  geojson,
  geoData,
  selectedMetric,
  startDate,
  endDate,
  selectedTopics,
  onStateSelected,
  showLegend = false,
  blueScale,
  redScale,
  isNormalized
}) {
  const svgRef = useRef();

  // Helper to format large numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

  useEffect(() => {
    if (!geojson || geoData.length === 0) return;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', '0 0 960 600')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Clear previous contents
    svg.selectAll('*').remove();

    // 1) Create a geoPath generator
    const path = d3.geoPath(
      d3.geoAlbersUsa()
        .scale(1300)
        .translate([487.5, 305])
    );

    // 2) Build a lookup map: stateName → stateData
    const stateGeoMap = new Map(geoData.map(d => [d.state, d]));

    // 3) Compute normalization stats once
    const demValues = geoData.map(d => d.democratTotal);
    const repValues = geoData.map(d => d.republicanTotal);
    const demMean = d3.mean(demValues);
    const repMean = d3.mean(repValues);
    const demStdDev = d3.deviation(demValues) || 1;
    const repStdDev = d3.deviation(repValues) || 1;

    // 4) Draw each state path, and update its data-tippy-content:
    svg.append('g')
      .selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('class', 'state-shape')
      .attr('d', path)
      .attr('fill', d => {
        const s = stateGeoMap.get(d.properties.name);
        if (!s) return '#eee';
        if (isNormalized) {
          const demZ = (s.democratTotal - demMean) / demStdDev;
          const repZ = (s.republicanTotal - repMean) / repStdDev;
          if (isNaN(demZ) || isNaN(repZ)) return '#eee';
          return demZ > repZ
            ? blueScale(s.democratTotal)
            : redScale(s.republicanTotal);
        }
        return s.democratTotal > s.republicanTotal
          ? blueScale(s.democratTotal)
          : redScale(s.republicanTotal);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('click', (event, d) => {
        const stateName = d.properties.name;
        const s = stateGeoMap.get(stateName);
        if (s) {
          onStateSelected({
            name: stateName,
            topicBreakdown: s.topic_breakdown,
          });
        }
      })
      .attr('data-tippy-content', d => {
        const stateName = d.properties.name;
        const s = stateGeoMap.get(stateName);
        if (!s) return '';
        const metricLabel = selectedMetric === 'posts'
          ? 'Total Posts'
          : selectedMetric === 'legislators'
          ? 'Total Legislators'
          : 'Total Engagement';

        const demDisplay = isNormalized
          ? formatNumber((s.democratTotal - demMean) / demStdDev)
          : formatNumber(s.democratTotal);

        const repDisplay = isNormalized
          ? formatNumber((s.republicanTotal - repMean) / repStdDev)
          : formatNumber(s.republicanTotal);

        const totalDisplay = formatNumber(s.total_engagement);
        const topicsDisplay = selectedTopics.length
          ? selectedTopics.join(', ')
          : 'All topics';

        return [
          `<strong>${stateName}</strong>`,
          `<strong>${metricLabel}:</strong> ${totalDisplay}`,
          `<strong>From:</strong> ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`,
          `<strong>Topics:</strong> ${topicsDisplay}`,
          `<strong>Democrats:</strong> ${demDisplay}`,
          `<strong>Republicans:</strong> ${repDisplay}`,
          `<strong>${isNormalized ? 'Normalized' : 'Raw'} Data</strong>`
        ].join('<br/>');
      });

    // 5) Initialize Tippy on every element with class "state-shape"
    tippy('.state-shape', {
      allowHTML: true,
      placement: 'right',
      animation: 'fade',
      delay: [0, 50],
      duration: [0, 0]
      // No need for a `content` callback because Tippy reads data-tippy-content directly
    });
  }, [
    geojson,
    geoData,
    selectedMetric,
    startDate,
    endDate,
    selectedTopics,
    onStateSelected,
    blueScale,
    redScale,
    isNormalized
  ]);

  return (
    <>
      <svg ref={svgRef} style={{ width: '100%' }} />

      {showLegend && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#1e3a8a', marginRight: '6px' }} />
            <span className="text-base-content">Democrat</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#cc0000', marginRight: '6px' }} />
            <span className="text-base-content">Republican</span>
          </div>
        </div>
      )}
    </>
  );
}

ChoroplethMap.propTypes = {
  geojson: PropTypes.object,
  geoData: PropTypes.array,
  selectedMetric: PropTypes.string,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  selectedTopics: PropTypes.array,
  onStateSelected: PropTypes.func,
  showLegend: PropTypes.bool,
  blueScale: PropTypes.func,
  redScale: PropTypes.func,
  isNormalized: PropTypes.bool
};

export default ChoroplethMap;
