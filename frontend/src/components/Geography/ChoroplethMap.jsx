import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import PropTypes from 'prop-types';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

// Note: The 'theme' css is removed as we will now control styling via DaisyUI classes.

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
    if (typeof num !== 'number' || !isFinite(num)) return 'N/A';
    if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(2);
  };

  useEffect(() => {
    if (!geojson || geoData.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', '0 0 960 600')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Clear previous contents to prevent duplication on re-render
    svg.selectAll('*').remove();

    // 1) Create a geoPath generator
    const path = d3.geoPath(d3.geoAlbersUsa().scale(1300).translate([487.5, 305]));

    // 2) Build a lookup map for efficient data access: stateName → stateData
    const stateGeoMap = new Map(geoData.map(d => [d.state, d]));

    // 3) Compute normalization stats once
    const demValues = geoData.map(d => d.democratTotal).filter(v => isFinite(v));
    const repValues = geoData.map(d => d.republicanTotal).filter(v => isFinite(v));
    const demMean = d3.mean(demValues) || 0;
    const repMean = d3.mean(repValues) || 0;
    const demStdDev = d3.deviation(demValues) || 1;
    const repStdDev = d3.deviation(repValues) || 1;

    // 4) Draw each state path and set its tooltip content
    const states = svg.append('g')
      .selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('class', 'state-shape cursor-pointer') // Add cursor-pointer for better UX
      .attr('d', path)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('click', (event, d) => {
        const stateName = d.properties.name;
        const stateData = stateGeoMap.get(stateName);
        if (stateData) {
          onStateSelected({
            name: stateName,
            topicBreakdown: stateData.topic_breakdown,
          });
        }
      });

    // 5) Set fill color and tooltip content in a separate loop for clarity
    states.attr('fill', d => {
        const s = stateGeoMap.get(d.properties.name);
        if (!s) return '#eee';

        if (isNormalized) {
          const demZ = (s.democratTotal - demMean) / demStdDev;
          const repZ = (s.republicanTotal - repMean) / repStdDev;
          if (isNaN(demZ) || isNaN(repZ)) return '#eee';
          return demZ > repZ ? blueScale(s.democratTotal) : redScale(s.republicanTotal);
        }
        return s.democratTotal > s.republicanTotal ? blueScale(s.democratTotal) : redScale(s.republicanTotal);
      })
      .attr('data-tippy-content', d => {
        const stateName = d.properties.name;
        const s = stateGeoMap.get(stateName);
        if (!s) return `<div class="p-2"><strong>${stateName}</strong><br/>No data available.</div>`;

        const metricLabel = selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1);
        const demDisplay = formatNumber(isNormalized ? (s.democratTotal - demMean) / demStdDev : s.democratTotal);
        const repDisplay = formatNumber(isNormalized ? (s.republicanTotal - repMean) / repStdDev : s.republicanTotal);
        
        const topicList = s.topic_breakdown ? Object.entries(s.topic_breakdown)
            .sort(([, a], [, b]) => (b.Democratic + b.Republican) - (a.Democratic + a.Republican))
            .slice(0, 3)
            .map(([topic, totals]) => `<li>${topic}: ${formatNumber(totals.Democratic + totals.Republican)}</li>`)
            .join('') : '<li>No topic breakdown available</li>';

        // Use DaisyUI/Tailwind classes for a themed tooltip that matches the app
        return `
          <div class="text-white p-3 max-w-xs">
            <h3 class="font-bold text-md mb-1 pb-1">
              ${stateName}
            </h3>
            <div class="text-xs text-white pb-2 mb-2">
              ${startDate.format('MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}
            </div>
            <div class="grid grid-cols-2 gap-4 my-2">
              <div>
                <strong class="text-blue-500">Democrat</strong><br/>
                <span class="text-lg font-extrabold text-blue-500">${demDisplay}</span>
              </div>
              <div class="text-right">
                <strong class="text-red-500">Republican</strong><br/>
                <span class="text-lg font-extrabold text-red-500">${repDisplay}</span>
              </div>
            </div>
            <div class="text-xs mt-2 pt-2">
              <strong>Top Topics by ${metricLabel}:</strong>
              <ul class="list-disc list-inside pl-1">${topicList}</ul>
            </div>
            <div class="text-center text-xs italic mt-3 pt-2 text-white">
              Click state for a detailed breakdown.
            </div>
          </div>
        `;
      });

    // 6) Initialize Tippy on all state shapes, removing the explicit theme
    const instances = tippy('.state-shape', {
      allowHTML: true,
      placement: 'top',
      animation: 'scale-subtle',
      delay: 50,
      trigger: 'mouseenter', // Explicitly set trigger to hover only
      hideOnClick: false, // Prevents tooltip from hiding when its reference is clicked
    });

    // 7) Return a cleanup function to destroy tooltips on re-render
    return () => {
      instances.forEach(instance => instance.destroy());
    };

  }, [geojson, geoData, selectedMetric, startDate, endDate, selectedTopics, onStateSelected, blueScale, redScale, isNormalized]);

  return (
    <div className="w-full">
      <svg ref={svgRef} className="w-full h-auto" />
      {showLegend && (
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mt-2">
          <div className="flex items-center">
            <div style={{ width: '18px', height: '18px', backgroundColor: '#1e3a8a', marginRight: '6px', borderRadius: '3px' }} />
            <span className="text-base-content text-sm">Democrat-Leaning</span>
          </div>
          <div className="flex items-center">
            <div style={{ width: '18px', height: '18px', backgroundColor: '#cc0000', marginRight: '6px', borderRadius: '3px' }} />
            <span className="text-base-content text-sm">Republican-Leaning</span>
          </div>
        </div>
      )}
    </div>
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
