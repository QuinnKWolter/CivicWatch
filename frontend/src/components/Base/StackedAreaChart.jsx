import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import PropTypes from 'prop-types';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { followCursor } from 'tippy.js';
import { topicIcons, formatNumber } from '../../utils/utils';

function StackedAreaChart({ data, activeTopics, colorMap, inverted, selectedMetric }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      
      // Only update if there's a significant change in dimensions
      if (Math.abs(dimensions.width - width) > 5 || Math.abs(dimensions.height - height) > 5) {
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    
    let resizeTimer;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateDimensions, 250); // 250ms debounce
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [dimensions]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height || dimensions.width < 50 || dimensions.height < 50 || !data.length) return;

    const margin = { 
      top: inverted ? Math.min(40, dimensions.height * 0.1) : Math.min(20, dimensions.height * 0.05),
      right: Math.min(30, dimensions.width * 0.05),
      bottom: inverted ? Math.min(20, dimensions.height * 0.05) : Math.min(40, dimensions.height * 0.1),
      left: Math.min(50, dimensions.width * 0.1)
    };
    
    const chartWidth = Math.max(50, dimensions.width - margin.left - margin.right);
    const chartHeight = Math.max(50, dimensions.height - margin.top - margin.bottom);

    const svg = d3.select(containerRef.current)
      .select('svg')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg.selectAll("*").remove(); // Clear previous content

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const parsedData = data.map(d => ({ ...d, date: parseDate(d.date) }));

    parsedData.sort((a, b) => a.date - b.date);

    const x = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.date))
      .range([0, chartWidth]);

    const stack = d3.stack()
      .keys(activeTopics)
      .value((d, key) => {
        const value = d[key]?.[inverted ? 'R' : 'D'];
        if (selectedMetric === 'engagement') {
          return (value?.likes || 0) + (value?.shares || 0);
        }
        return value?.[selectedMetric] || 0;
      })
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const layers = stack(parsedData);

    const maxSum = d3.max(layers, layer => d3.max(layer, d => d[1]));
    const y = d3.scalePow()
      .exponent(0.5) // Square root scale
      .domain([0, maxSum])
      .range(inverted ? [0, chartHeight] : [chartHeight, 0]);

    const area = d3.area()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    g.selectAll(".layer")
      .data(layers)
      .enter().append("path")
      .attr("class", "layer")
      .attr("d", area)
      .style("fill", d => colorMap[d.key]?.[inverted ? 'R' : 'D'])
      .on('mouseover', (event, d) => {
        const totalValue = d3.sum(d, point => point[1] - point[0]);
        const formattedValue = formatNumber(totalValue);
        const IconComponent = topicIcons[d.key];
        const color = colorMap[d.key]?.[inverted ? 'R' : 'D'];
        
        setTooltipContent(
          <div style={{ 
            color, 
            borderRadius: '8px', 
            padding: '10px', 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            height: '100%',
            width: '100%',
          }}>
            <div style={{ display: 'flex', marginBottom: '5px' }}>
              <IconComponent style={{ marginRight: '5px', fontSize: '2em' }} />
            </div>
            <div>
              <strong style={{ fontSize: '1.1em', color: 'white' }}>Topic: {d.key}</strong>
            </div>
            <div>
              <strong style={{ fontSize: '1.1em', color: 'white' }}>Value: {formattedValue}</strong> 
            </div>
          </div>
        );
        setTooltipVisible(true);
      })
      .on('mouseout', () => {
        setTooltipVisible(false);
      });

    const xAxisDates = parsedData.filter((d, i, arr) => {
      const date = d.date;
      return date.getDate() === 1 || (i > 0 && arr[i - 1].date.getMonth() !== date.getMonth());
    }).map(d => d.date);

    const xAxis = inverted ? d3.axisTop(x) : d3.axisBottom(x);
    xAxis.tickValues(xAxisDates)
      .tickSize(-chartHeight)
      .tickPadding(10)
      .tickFormat(d3.timeFormat("%b '%y"));

    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0,${inverted ? 0 : chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", inverted ? "translate(30,-20) rotate(-45)" : "rotate(-45)")
      .style("text-anchor", "end");

    g.selectAll(".axis--x line")
      .style("stroke-opacity", 0.2);

    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).ticks(6, "~s").tickSize(-chartWidth).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

  }, [data, activeTopics, colorMap, inverted, dimensions.width, dimensions.height, selectedMetric]);

  return (
    <div ref={containerRef} className="w-full h-full visualization-container">
      <Tippy
        content={tooltipContent}
        visible={tooltipVisible}
        arrow={false}
        placement="top"
        followCursor={true}
        appendTo={() => document.body}
        plugins={[followCursor]}
      >
        <svg 
          width="100%" 
          height="100%" 
          className="chart-svg"
          viewBox={dimensions.width && dimensions.height ? `0 0 ${dimensions.width} ${dimensions.height}` : "0 0 600 300"}
          preserveAspectRatio="xMidYMid meet"
        />
      </Tippy>
    </div>
  );
}

StackedAreaChart.propTypes = {
  data: PropTypes.array.isRequired,
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  colorMap: PropTypes.object.isRequired,
  inverted: PropTypes.bool.isRequired,
  selectedMetric: PropTypes.string.isRequired
};

export default StackedAreaChart;