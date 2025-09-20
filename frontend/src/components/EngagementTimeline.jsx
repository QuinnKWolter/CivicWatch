import { useRef, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { FaSpinner, FaChartLine } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { followCursor } from 'tippy.js';
import { topicIcons, formatNumber, colorMap, topicNames } from '../utils/utils';
import detectEvents from './detectEvents';
import SectionTitle from './SectionTitle';

// Extend dayjs with comparison plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Loading indicator
const Loading = () => (
  <div className="flex flex-col items-center justify-center h-full">
    <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
    <p className="text-lg">Loading engagement timeline data...</p>
  </div>
);

// Error banner
const ErrorBanner = ({ message }) => (
  <div className="alert alert-error shadow-lg">
    <div className="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="ml-2">{message}</span>
    </div>
  </div>
);

ErrorBanner.propTypes = {
  message: PropTypes.string.isRequired
};

export default function EngagementTimeline({ 
  activeTopics, 
  startDate, 
  endDate, 
  onDateChange 
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Interactive state
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [hoverDate, setHoverDate] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState(null);
  const [dragEndDate, setDragEndDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [hoverEvent, setHoverEvent] = useState(null);
  const [detectorMode, setDetectorMode] = useState('robust');

  // Fetch data with server-side filters (topics excluded to avoid re-query on toggles)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', dayjs(startDate).format('YYYY-MM-DD'));
        if (endDate) params.append('end_date', dayjs(endDate).format('YYYY-MM-DD'));
        const url = `/api/flow/bipartite_data/?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const payload = await res.json();
        setData(payload);
        setError('');
      } catch {
        console.error('Error fetching engagement timeline data');
        setError('Failed to load engagement timeline data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  // Sort topics by total engagement
  const sortedTopics = useMemo(() => {
    return [...activeTopics]
      .map(topic => {
        const total = data.reduce((sum, item) => sum + (item[topic] || 0), 0);
        return { topic, total };
      })
      .sort((a, b) => a.total - b.total)
      .map(t => t.topic);
  }, [activeTopics, data]);

  // Filter data by date range
  const filteredData = useMemo(
    () => data,
    [data]
  );

  // Compute dynamic spike events asynchronously for performance
  useEffect(() => {
    if (!filteredData.length || !activeTopics || activeTopics.length === 0) {
      setEvents([]);
      return;
    }

    const computeAsync = () => {
      const result = detectEvents({ filteredData, activeTopics, detectorMode });
      setEvents(result);
    };

    // Defer to keep timeline responsive
    const id = setTimeout(computeAsync, 0);
    return () => clearTimeout(id);
  }, [filteredData, activeTopics, detectorMode]);

  // Responsive dimensions handling
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };

    // Initial measurement with multiple attempts
    updateDimensions();
    
    // Additional attempts to ensure we get dimensions
    const timeoutIds = [
      setTimeout(updateDimensions, 50),
      setTimeout(updateDimensions, 100),
      setTimeout(updateDimensions, 200)
    ];
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDimensions, 50);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, []);

  // D3 chart rendering
  useEffect(() => {
    if (!filteredData.length) {
      return;
    }

    // If dimensions aren't ready yet, try to get them directly
    let effectiveDimensions = dimensions;
    if (!dimensions.width || !dimensions.height) {
      const container = containerRef.current;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) {
          effectiveDimensions = { width, height };
          setDimensions({ width, height });
        } else {
          // Use fallback dimensions and schedule a retry
          effectiveDimensions = { width: 600, height: 300 };
          setTimeout(() => {
            const container = containerRef.current;
            if (container) {
              const { width, height } = container.getBoundingClientRect();
              if (width > 0 && height > 0) {
                setDimensions({ width, height });
              }
            }
          }, 100);
        }
      } else {
        return; // No container, wait for next render
      }
    }

    // Clear any existing content first
    d3.select(containerRef.current).selectAll("*").remove();
    
    const margin = { 
      top: 20,
      right: 20,
      bottom: 60,
      left: 60
    };
    
    const chartWidth = Math.max(50, effectiveDimensions.width - margin.left - margin.right);
    const chartHeight = Math.max(50, effectiveDimensions.height - margin.top - margin.bottom);
    
    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr('width', '100%')
      .attr('height', '100%')
      .style('cursor', 'crosshair');

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const parsedData = filteredData.map(d => ({ ...d, date: parseDate(d.date) }));
    parsedData.sort((a, b) => a.date - b.date);

    const x = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.date))
      .range([0, chartWidth]);

    const stack = d3.stack()
      .keys(sortedTopics)
      .value((d, key) => d[key] || 0)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const layers = stack(parsedData);
    const maxSum = d3.max(layers, layer => d3.max(layer, d => d[1]));
    
    const y = d3.scalePow()
      .exponent(0.5)
      .domain([0, maxSum])
      .range([chartHeight, 0]);

    const area = d3.area()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    // Create the stacked area paths
    g.selectAll(".layer")
      .data(layers)
      .enter().append("path")
      .attr("class", "layer")
      .attr("d", area)
      .style("fill", d => colorMap[d.key]?.color || '#ccc')
      .style("opacity", 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this).style("opacity", 1);
        const totalValue = d3.sum(d, point => point[1] - point[0]);
        const formattedValue = formatNumber(totalValue);
        const IconComponent = topicIcons[d.key];
        const color = colorMap[d.key]?.color || '#ccc';
        
        setTooltipContent(
          <div style={{ 
            color, 
            borderRadius: '8px', 
            padding: '12px', 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minWidth: '180px',
            background: `linear-gradient(135deg, ${color}dd, ${color}aa)`,
            border: `2px solid ${color}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', marginBottom: '8px', alignItems: 'center' }}>
              <IconComponent style={{ marginRight: '8px', fontSize: '1.8em', color: 'white' }} />
              <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {topicNames[d.key] || d.key}
              </span>
            </div>
            <div style={{ 
              fontSize: '1.1em', 
              color: 'white', 
              fontWeight: 'bold',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              marginBottom: '8px'
            }}>
              {formattedValue} engagements
            </div>
            {hoverDate && (
              <div style={{ 
                fontSize: '0.9em', 
                color: 'white', 
                opacity: 0.9, 
                padding: '4px 10px',
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(4px)'
              }}>
                {hoverDate.format('MMM D, YYYY')}
              </div>
            )}
          </div>
        );
        setTooltipVisible(true);
      })
      .on('mouseout', function() {
        d3.select(this).style("opacity", 0.8);
        setTooltipVisible(false);
      });

    // Add transparent overlay for date selection
    const overlay = g.append("rect")
      .attr("class", "date-selection-overlay")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .style("cursor", "crosshair");

    // Date selection event handlers
    overlay
      .on("mousemove", (event) => {
        const [mouseX] = d3.pointer(event);
        const date = x.invert(mouseX);
        setHoverDate(dayjs(date));
        
        if (isDragging && dragStartDate) {
          setDragEndDate(dayjs(date));
        }
      })
      .on("mouseleave", () => {
        if (!isDragging) {
          setHoverDate(null);
          setTooltipVisible(false);
        }
      })
      .on("mousedown", (event) => {
        event.preventDefault();
        const [mouseX] = d3.pointer(event);
        const date = x.invert(mouseX);
        setIsDragging(true);
        setDragStartDate(dayjs(date));
        setDragEndDate(dayjs(date));
      })
      .on("mouseup", (event) => {
        event.preventDefault();
        if (isDragging && dragStartDate && dragEndDate && onDateChange) {
          // Determine start and end dates based on drag direction
          let newStartDate, newEndDate;
          
          if (dragStartDate.isBefore(dragEndDate)) {
            newStartDate = dragStartDate;
            newEndDate = dragEndDate;
          } else {
            newStartDate = dragEndDate;
            newEndDate = dragStartDate;
          }
          
          // Ensure minimum 2-day range
          const durationMs = newEndDate.diff(newStartDate, 'millisecond');
          const minDurationMs = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
          
          if (durationMs < minDurationMs) {
            // Extend the end date to ensure minimum duration
            newEndDate = newStartDate.add(2, 'day');
          }
          
          onDateChange(newStartDate, newEndDate);
        }
        
        // Reset drag state
        setIsDragging(false);
        setDragStartDate(null);
        setDragEndDate(null);
        setHoverDate(null);
      })
      .on("contextmenu", (event) => {
        event.preventDefault();
        if (onDateChange) {
          // Clear the date range by setting to full range
          onDateChange(dayjs('2020-01-01'), dayjs('2021-12-31'));
        }
      });

    // Add hover line
    if (hoverDate && !isDragging && !hoverEvent) {
      const hoverX = x(hoverDate.toDate());
      g.append("line")
        .attr("class", "hover-line")
        .attr("x1", hoverX)
        .attr("x2", hoverX)
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .style("stroke", "#605dff")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "5,5")
        .style("pointer-events", "none")
        .style("opacity", 0.8);
    }

    // Add drag selection lines
    if (isDragging && dragStartDate && dragEndDate) {
      // Start date line (blue)
      const startX = x(dragStartDate.toDate());
      g.append("line")
        .attr("class", "drag-start-line")
        .attr("x1", startX)
        .attr("x2", startX)
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .style("stroke", "#3b82f6")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "5,5")
        .style("pointer-events", "none")
        .style("opacity", 0.9);

      // End date line (orange)
      const endX = x(dragEndDate.toDate());
      g.append("line")
        .attr("class", "drag-end-line")
        .attr("x1", endX)
        .attr("x2", endX)
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .style("stroke", "#f97316")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "5,5")
        .style("pointer-events", "none")
        .style("opacity", 0.9);

      // Selection area between the lines
      if (startX !== endX) {
        g.append("rect")
          .attr("class", "selection-area")
          .attr("x", Math.min(startX, endX))
          .attr("y", 0)
          .attr("width", Math.abs(endX - startX))
          .attr("height", chartHeight)
          .style("fill", "rgba(59, 130, 246, 0.15)")
          .style("stroke", "rgba(59, 130, 246, 0.3)")
          .style("stroke-width", 1)
          .style("stroke-dasharray", "3,3")
          .style("pointer-events", "none");
      }
    }

    // Create axes
    const xAxis = d3.axisBottom(x)
      .tickFormat(d3.timeFormat("%b '%y"))
      .tickSize(-chartHeight)
      .tickPadding(10);

    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "12px");

    g.selectAll(".axis--x line")
      .style("stroke-opacity", 0.2);

    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).ticks(6, "~s").tickSize(-chartWidth).tickPadding(10))
      .selectAll("line")
      .style("stroke-opacity", 0.2);

    g.selectAll(".axis--y text")
      .style("font-size", "12px");

    // Draw dynamic event glyphs (diamonds) centered at highest overall engagement within window, aligned to chart top
    if (events && events.length) {
      const eventGroup = g.append('g').attr('class', 'events-layer');

      // Build helpers to map dates to indices and topics to layers
      const layerByKey = new Map();
      layers.forEach(layer => layerByKey.set(layer.key, layer));

      const minZ = d3.min(events, e => e.peakZ) || 0;
      const maxZ = d3.max(events, e => e.peakZ) || 1;
      const sizeFor = (z) => {
        if (maxZ === minZ) return 140;
        const norm = (z - minZ) / (maxZ - minZ); // 0..1
        return 110 + 140 * norm; // area size
      };

      events.forEach((ev) => {
        const topic = ev.associatedTopic;
        const anchorDate = ev.maxDate || ev.topicPeakDate || ev.peakDate;
        const xPos = x(anchorDate);
        if (Number.isNaN(xPos)) return;
        const strokeColor = colorMap[topic]?.color || '#666';
        const gray = Math.floor(192 + Math.random() * 63); // light-ish grayscale
        const fillColor = `rgb(${gray},${gray},${gray})`;

        // Align along the very top of the chart (constant y)
        const yPos = 0;

        const glyph = eventGroup.append('path')
          .attr('transform', `translate(${xPos}, ${yPos})`)
          .attr('d', d3.symbol().type(d3.symbolDiamond).size(sizeFor(ev.peakZ)))
          .attr('fill', fillColor)
          .attr('stroke', strokeColor)
          .attr('stroke-width', 2)
          .style('cursor', 'pointer');

        // Hover behavior: draw start/end lines
        const onEnter = () => {
          const sX = x(ev.startDate);
          const eX = x(ev.endDate);
          eventGroup.append('line')
            .attr('class', 'event-start-line')
            .attr('x1', sX).attr('x2', sX)
            .attr('y1', 0).attr('y2', chartHeight)
            .style('stroke', '#3b82f6')
            .style('stroke-width', 2)
            .style('stroke-dasharray', '5,5')
            .style('pointer-events', 'none');
          eventGroup.append('line')
            .attr('class', 'event-end-line')
            .attr('x1', eX).attr('x2', eX)
            .attr('y1', 0).attr('y2', chartHeight)
            .style('stroke', '#f97316')
            .style('stroke-width', 2)
            .style('stroke-dasharray', '5,5')
            .style('pointer-events', 'none');
          setHoverEvent(ev);
          setHoverDate(null);
        };
        const onLeave = () => {
          eventGroup.selectAll('.event-start-line,.event-end-line').remove();
          setHoverEvent(null);
        };

        glyph
          .on('mouseenter', onEnter)
          .on('mouseleave', onLeave)
          .on('click', () => {
            if (onDateChange) {
              // mimic scrubbing selection with minimum duration check
              let newStartDate = dayjs(ev.startDate);
              let newEndDate = dayjs(ev.endDate);
              
              // Ensure minimum 2-day range
              const durationMs = newEndDate.diff(newStartDate, 'millisecond');
              const minDurationMs = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
              
              if (durationMs < minDurationMs) {
                // Extend the end date to ensure minimum duration
                newEndDate = newStartDate.add(2, 'day');
              }
              
              onDateChange(newStartDate, newEndDate);
            }
          });
      });
    }

  }, [filteredData, sortedTopics, dimensions, hoverDate, isDragging, dragStartDate, dragEndDate, events, hoverEvent, onDateChange]);

  // Global mouse up handler for drag completion
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && dragStartDate && dragEndDate && onDateChange) {
        let newStartDate, newEndDate;
        if (dragStartDate.isBefore(dragEndDate)) {
          newStartDate = dragStartDate;
          newEndDate = dragEndDate;
        } else {
          newStartDate = dragEndDate;
          newEndDate = dragStartDate;
        }
        
        // Ensure minimum 2-day range
        const durationMs = newEndDate.diff(newStartDate, 'millisecond');
        const minDurationMs = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
        
        if (durationMs < minDurationMs) {
          // Extend the end date to ensure minimum duration
          newEndDate = newStartDate.add(2, 'day');
        }
        
        onDateChange(newStartDate, newEndDate);
      }
      setIsDragging(false);
      setDragStartDate(null);
      setDragEndDate(null);
      setHoverDate(null);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStartDate, dragEndDate, onDateChange]);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 pb-1">
        <SectionTitle
          icon={<FaChartLine />}
          text="Engagement Timeline"
          helpContent={
            <div className="text-left">
              <ul className="list-disc list-inside space-y-1">
                <li>This visualization shows topic activity over time.</li>
                <li>Each colored area represents a topic&apos;s contribution to the total activity.</li>
                <li>Hover over the chart to see dates. Click and drag to select a date range.</li>
                <li>Drag forward to set start→end, drag backward to set end→start.</li>
                <li>Right-click to reset to the full date range.</li>
              </ul>
            </div>
          }
        />
        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="text-xs opacity-80">Detector:</span>
          <div className="join">
            <button
              className={`btn btn-xs join-item ${detectorMode === 'robust' ? 'btn-primary' : ''}`}
              onClick={() => setDetectorMode('robust')}
            >
              Robust Z
            </button>
            <button
              className={`btn btn-xs join-item ${detectorMode === 'cumulative' ? 'btn-primary' : ''}`}
              onClick={() => setDetectorMode('cumulative')}
            >
              Cumulative Z
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative min-h-0">
         {/* Topic tooltip */}
         <Tippy
           content={tooltipContent}
           visible={tooltipVisible}
           arrow={false}
           placement="top"
           followCursor={true}
           appendTo={() => document.body}
           plugins={[followCursor]}
           trigger="manual"
         />
         
          {/* Date tooltip for when not hovering over topics or event glyphs */}
          <Tippy
            content={
              <div className="text-center text-white px-4 py-3 rounded-lg shadow-xl">
                <div className="font-bold text-lg mb-1">{hoverDate?.format('MMM D, YYYY')}</div>
                <div className="text-sm opacity-80">
                  Left-click and drag to select range
                </div>
                <div className="text-sm opacity-80">
                  Right-click to clear selection
                </div>
              </div>
            }
            visible={hoverDate && !isDragging && !tooltipVisible && !hoverEvent}
            placement="top"
            arrow={true}
            appendTo={() => document.body}
            followCursor={true}
            plugins={[followCursor]}
            trigger="manual"
          />

          {/* Event tooltip */}
          <Tippy
            content={
              hoverEvent ? (
                <div className="text-center text-white px-4 py-3 rounded-lg shadow-xl">
                  <div className="font-bold text-lg mb-1">Event Window</div>
                  <div className="text-sm opacity-90">
                    {dayjs(hoverEvent.startDate).format('MMM D, YYYY')} – {dayjs(hoverEvent.endDate).format('MMM D, YYYY')}
                  </div>
                  <div className="text-xs opacity-75 mt-1">Topic: {hoverEvent.associatedTopic || 'all'} • z≈{hoverEvent.peakZ.toFixed(1)}</div>
                </div>
              ) : null
            }
            visible={!!hoverEvent}
            placement="top"
            arrow={true}
            appendTo={() => document.body}
            followCursor={true}
            plugins={[followCursor]}
            trigger="manual"
          />
          
          {/* Dragging tooltip */}
          <Tippy
            content={
              <div className="text-center text-white px-4 py-3 rounded-lg shadow-xl">
                <div className="font-bold text-lg mb-1">Selecting Date Range</div>
                <div className="text-sm opacity-90">
                  {dragStartDate && dragEndDate 
                    ? `${dragStartDate.format('MMM D')} - ${dragEndDate.format('MMM D')}`
                    : 'Drag to select range'
                  }
                </div>
              </div>
            }
            visible={isDragging && dragStartDate && dragEndDate}
            placement="top"
            arrow={true}
            appendTo={() => document.body}
            followCursor={true}
            plugins={[followCursor]}
            trigger="manual"
          />
        
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

EngagementTimeline.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  onDateChange: PropTypes.func
};
