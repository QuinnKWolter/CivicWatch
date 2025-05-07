// import '../../App.css';
// import { useEffect, useRef } from 'react';
// import * as d3 from 'd3';
// import PropTypes from 'prop-types';

// function ChoroplethMap({ 
//   geojson, 
//   geoData, 
//   selectedMetric, 
//   startDate, 
//   endDate, 
//   selectedTopics,
//   onStateSelected,
//   showLegend = false,
//   blueScale,
//   redScale
// }) {
//   const svgRef = useRef();

//   // Render the map when data or dimensions change
//   useEffect(() => {
//     if (!geojson || geoData.length === 0) return;

//     const svg = d3.select(svgRef.current)
//       .attr('viewBox', '0 0 960 600')
//       .attr('preserveAspectRatio', 'xMidYMid meet');

//     svg.selectAll('*').remove();

//     const tooltip = d3.select('body').append('div')
//       .attr('class', 'tooltip')
//       .style('position', 'absolute')
//       .style('pointer-events', 'none')
//       .style('background', 'var(--b2, #e0f7fa)')
//       .style('color', 'var(--bc, #333)')
//       .style('border', '1px solid var(--b3, #ccc)')
//       .style('padding', '10px')
//       .style('font-size', '14px')
//       .style('border-radius', '6px')
//       .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
//       .style('opacity', 0)
//       .style('z-index', 9999);

//     const path = d3.geoPath(d3.geoAlbersUsa().scale(1300).translate([487.5, 305]));

//     const stateGeoMap = new Map();
//     geoData.forEach(d => stateGeoMap.set(d.state, d));

//     const metricLabel = selectedMetric === 'posts' ? 'Total Posts' : 
//                        selectedMetric === 'legislators' ? 'Total Legislators' : 
//                        'Total Engagement';

//     svg.append('g')
//       .selectAll('path')
//       .data(geojson.features)
//       .join('path')
//       .attr('d', path)
//       .attr('fill', d => {
//         const stateName = d.properties.name;
//         const stateData = stateGeoMap.get(stateName);
//         if (!stateData) return '#eee';
        
//         const dem = stateData.democratTotal;
//         const rep = stateData.republicanTotal;
        
//         if (dem > rep) return blueScale(dem);
//         return redScale(rep);
//       })
//       .attr('stroke', '#fff')
//       .attr('stroke-width', 0.5)
//       .on('mousemove', function (event, d) {
//         const stateName = d.properties.name;
//         const stateData = stateGeoMap.get(stateName);
//         if (!stateData) return;

//         const tooltipHtml = `
//           <strong>${stateName}</strong><br/>
//           <strong>${metricLabel}:</strong> ${formatNumber(stateData.total_engagement)}<br/>
//           <strong>From date:</strong> ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}<br/>
//           <strong>On topics:</strong> ${selectedTopics.join(', ') || 'All topics'}<br/>
//           With <strong>Democrats:</strong> ${formatNumber(stateData.democratTotal)}<br/>
//           And <strong>Republicans:</strong> ${formatNumber(stateData.republicanTotal)}<br/>
//         `;

//         tooltip
//           .html(tooltipHtml)
//           .style("left", `${event.pageX + 10}px`)
//           .style("top", `${event.pageY + 10}px`)
//           .transition().duration(100)
//           .style("opacity", 0.95);
//       })
//       .on('mouseout', () => {
//         tooltip.transition().duration(300).style('opacity', 0);
//       })
//       .on('click', (event, d) => {
//         const stateName = d.properties.name;
//         const stateData = stateGeoMap.get(stateName);
//         if (stateData) {
//           onStateSelected({
//             name: stateName,
//             topicBreakdown: stateData.topic_breakdown,
//           });
//         }
//       });

//     return () => tooltip.remove();
//   }, [geojson, geoData, selectedMetric, startDate, endDate, selectedTopics, onStateSelected, blueScale, redScale]);

//   const formatNumber = (num) => {
//     if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
//     if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
//     return num;
//   };

//   return (
//     <>
//       <svg ref={svgRef} style={{ width: '100%' }} />
      
//       {showLegend && (
//         <div style={{ display: 'flex', gap: '20px', marginTop: '10px', justifyContent: 'center' }}>
//           <div style={{ display: 'flex', alignItems: 'center' }}>
//             <div style={{ width: '20px', height: '20px', backgroundColor: '#1e3a8a', marginRight: '6px' }}></div>
//             <span className="text-base-content">Democrat</span>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center' }}>
//             <div style={{ width: '20px', height: '20px', backgroundColor: '#cc0000', marginRight: '6px' }}></div>
//             <span className="text-base-content">Republican</span>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// ChoroplethMap.propTypes = {
//   geojson: PropTypes.object,
//   geoData: PropTypes.array,
//   selectedMetric: PropTypes.string,
//   startDate: PropTypes.object,
//   endDate: PropTypes.object,
//   selectedTopics: PropTypes.array,
//   onStateSelected: PropTypes.func,
//   showLegend: PropTypes.bool,
//   blueScale: PropTypes.func,
//   redScale: PropTypes.func
// };

// export default ChoroplethMap;



import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import PropTypes from 'prop-types';

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
  redScale
}) {
  const svgRef = useRef();

  useEffect(() => {
    if (!geojson || geoData.length === 0) return;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', '0 0 960 600')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg.selectAll('*').remove();

    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'var(--b2, #e0f7fa)')
      .style('color', 'var(--bc, #333)')
      .style('border', '1px solid var(--b3, #ccc)')
      .style('padding', '10px')
      .style('font-size', '14px')
      .style('border-radius', '6px')
      .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
      .style('opacity', 0)
      .style('z-index', 9999);

    const path = d3.geoPath(d3.geoAlbersUsa().scale(1300).translate([487.5, 305]));

    const stateGeoMap = new Map(geoData.map(d => [d.state, d]));

    const demValues = geoData.map(d => d.democratTotal);
    const repValues = geoData.map(d => d.republicanTotal);
    const demMean = d3.mean(demValues);
    const repMean = d3.mean(repValues);
    const demStdDev = d3.deviation(demValues) || 1;
    const repStdDev = d3.deviation(repValues) || 1;

    const getColor = (stateName) => {
      const stateData = stateGeoMap.get(stateName);
      if (!stateData) return '#eee';

      const { democratTotal, republicanTotal } = stateData;
      const demZ = (democratTotal - demMean) / demStdDev;
      const repZ = (republicanTotal - repMean) / repStdDev;

      if (isNaN(demZ) || isNaN(repZ)) return '#eee';
      if (demZ > repZ) return blueScale(democratTotal);
      if (repZ > demZ) return redScale(republicanTotal);
      return '#eee';
    };

    const metricLabel = selectedMetric === 'posts' ? 'Total Posts' : 
                        selectedMetric === 'legislators' ? 'Total Legislators' : 
                        'Total Engagement';

    svg.append('g')
      .selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('d', path)
      .attr('fill', d => getColor(d.properties.name))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mousemove', function (event, d) {
        const stateName = d.properties.name;
        const stateData = stateGeoMap.get(stateName);
        if (!stateData) return;

        const tooltipHtml = `
          <strong>${stateName}</strong><br/>
          <strong>${metricLabel}:</strong> ${formatNumber(stateData.total_engagement)}<br/>
          <strong>From:</strong> ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}<br/>
          <strong>Topics:</strong> ${selectedTopics.join(', ') || 'All topics'}<br/>
          <strong>Democrats:</strong> ${formatNumber(stateData.democratTotal)}<br/>
          <strong>Republicans:</strong> ${formatNumber(stateData.republicanTotal)}<br/>
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
        const stateData = stateGeoMap.get(stateName);
        if (stateData) {
          onStateSelected({
            name: stateName,
            topicBreakdown: stateData.topic_breakdown,
          });
        }
      });

    return () => tooltip.remove();
  }, [geojson, geoData, selectedMetric, startDate, endDate, selectedTopics, onStateSelected, blueScale, redScale]);

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

  return (
    <>
      <svg ref={svgRef} style={{ width: '100%' }} />
      
      {showLegend && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#1e3a8a', marginRight: '6px' }}></div>
            <span className="text-base-content">Democrat</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '20px', height: '20px', backgroundColor: '#cc0000', marginRight: '6px' }}></div>
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
  redScale: PropTypes.func
};

export default ChoroplethMap;

