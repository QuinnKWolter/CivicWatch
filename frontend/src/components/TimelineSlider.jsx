import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { FaCalendarAlt } from 'react-icons/fa';

function TimelineSlider({ startDate, endDate, onDateChange }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 40 });
  const [isStartDateEditing, setIsStartDateEditing] = useState(false);
  const [isEndDateEditing, setIsEndDateEditing] = useState(false);

  const minDate = dayjs('2020-01-01');
  const maxDate = dayjs('2021-12-31');

  // Initialize local dates with defaults if not provided
  const [localStartDate, setLocalStartDate] = useState(startDate || minDate);
  const [localEndDate, setLocalEndDate] = useState(endDate || maxDate);

  // Update local dates when props change
  useEffect(() => {
    if (startDate) setLocalStartDate(startDate);
    if (endDate) setLocalEndDate(endDate);
  }, [startDate, endDate]);

  // Important dates to mark with glyphs
  const importantDates = [
    { date: '2020-03-13', label: 'COVID Emergency Declaration' },
    { date: '2020-11-03', label: 'US Presidential Election' },
    { date: '2021-01-06', label: 'Capitol Riot' },
    // Add more important dates as needed
  ];

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 40
        });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width) return;

    const margin = { left: 50, right: 50 };
    const width = dimensions.width - margin.left - margin.right;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const timeScale = d3.scaleTime()
      .domain([minDate.toDate(), maxDate.toDate()])
      .range([0, width]);

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, 20)`);

    // Draw timeline line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("stroke", "#666")
      .attr("stroke-width", 2);

    // Add important date glyphs
    importantDates.forEach(({ date, label }) => {
      const glyph = g.append("g")
        .attr("transform", `translate(${timeScale(new Date(date))}, 0)`);

      glyph.append("circle")
        .attr("r", 4)
        .attr("fill", "#666");

      glyph.append("title")
        .text(label);
    });

    // Add handles
    const dragBehavior = d3.drag()
      .on("drag", function(event) {
        const date = timeScale.invert(event.x);
        const handle = d3.select(this);
        const isStart = handle.classed("start-handle");
        
        if (isStart) {
          if (date >= minDate.toDate() && date < localEndDate) {
            setLocalStartDate(dayjs(date));
            onDateChange(dayjs(date), localEndDate);
          }
        } else {
          if (date <= maxDate.toDate() && date > localStartDate) {
            setLocalEndDate(dayjs(date));
            onDateChange(localStartDate, dayjs(date));
          }
        }
      });

    // Start handle
    g.append("circle")
      .attr("class", "start-handle")
      .attr("cx", timeScale(localStartDate.toDate()))
      .attr("cy", 0)
      .attr("r", 8)
      .attr("fill", "#4B5563")
      .call(dragBehavior);

    // End handle
    g.append("circle")
      .attr("class", "end-handle")
      .attr("cx", timeScale(localEndDate.toDate()))
      .attr("cy", 0)
      .attr("r", 8)
      .attr("fill", "#4B5563")
      .call(dragBehavior);

  }, [dimensions, localStartDate, localEndDate]);

  const handleClickOutside = (e) => {
    if (!e.target.closest('.date-input')) {
      setIsStartDateEditing(false);
      setIsEndDateEditing(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full px-4">
      <svg 
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="cursor-pointer"
      />
      
      {/* Date Input Fields */}
      <div className="absolute left-12 -top-1">
        {isStartDateEditing ? (
          <input
            type="date"
            className="date-input p-1 text-sm rounded border"
            value={localStartDate?.format('YYYY-MM-DD') || '2020-01-01'}
            min="2020-01-01"
            max="2021-12-31"
            onChange={(e) => {
              const newDate = dayjs(e.target.value);
              setLocalStartDate(newDate);
              onDateChange(newDate, localEndDate);
            }}
          />
        ) : (
          <button
            className="date-input flex items-center gap-2 bg-gray-700 px-2 py-1 rounded text-sm"
            onClick={() => setIsStartDateEditing(true)}
          >
            <FaCalendarAlt />
            {localStartDate?.format('MMM D, YYYY') || 'Jan 1, 2020'}
          </button>
        )}
      </div>

      <div className="absolute right-12 -top-1">
        {isEndDateEditing ? (
          <input
            type="date"
            className="date-input p-1 text-sm rounded border"
            value={localEndDate?.format('YYYY-MM-DD') || '2021-12-31'}
            min="2020-01-01"
            max="2021-12-31"
            onChange={(e) => {
              const newDate = dayjs(e.target.value);
              setLocalEndDate(newDate);
              onDateChange(localStartDate, newDate);
            }}
          />
        ) : (
          <button
            className="date-input flex items-center gap-2 bg-gray-700 px-2 py-1 rounded text-sm"
            onClick={() => setIsEndDateEditing(true)}
          >
            <FaCalendarAlt />
            {localEndDate?.format('MMM D, YYYY') || 'Dec 31, 2021'}
          </button>
        )}
      </div>
    </div>
  );
}

TimelineSlider.propTypes = {
  startDate: PropTypes.object,  // Changed from required to optional
  endDate: PropTypes.object,    // Changed from required to optional
  onDateChange: PropTypes.func.isRequired
};

TimelineSlider.defaultProps = {
  startDate: null,
  endDate: null
};

export default TimelineSlider; 