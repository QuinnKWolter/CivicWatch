import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaVirus, FaVoteYea, FaGavel, FaUserSlash, FaStore } from 'react-icons/fa';
import { GiCapitol } from 'react-icons/gi';
import ReactDOM from 'react-dom/client';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import tippy from 'tippy.js';
import 'tippy.js/animations/scale-subtle.css';

function TimelineSlider({ 
  startDate = null,
  endDate = null,
  onDateChange
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 40 });
  const [isStartDateEditing, setIsStartDateEditing] = useState(false);
  const [isEndDateEditing, setIsEndDateEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const tooltipRef = useRef(null);

  const minDate = dayjs('2020-01-01');
  const maxDate = dayjs('2021-12-31');

  // Initialize local dates with defaults and bounds
  const [localStartDate, setLocalStartDate] = useState(() => {
    if (!startDate) return minDate;
    return startDate.isBefore(minDate) ? minDate : startDate;
  });
  
  const [localEndDate, setLocalEndDate] = useState(() => {
    if (!endDate) return maxDate;
    return endDate.isAfter(maxDate) ? maxDate : endDate;
  });

  // Update local dates when props change, respecting bounds
  useEffect(() => {
    if (startDate) {
      setLocalStartDate(startDate.isBefore(minDate) ? minDate : startDate);
    }
    if (endDate) {
      setLocalEndDate(endDate.isAfter(maxDate) ? maxDate : endDate);
    }
  }, [startDate, endDate]);

  // Updated important dates with icons, notes, position, and color
  const importantDates = [
    { 
      date: '2020-03-13', 
      label: 'COVID Emergency Declaration',
      icon: FaVirus,
      notes: "President Trump declared a national emergency concerning the COVID-19 outbreak, freeing up $50 billion in federal funding and establishing public-private partnerships to expand testing capabilities.",
      position: 'above',
      color: '#0000FF' // Blue
    },
    { 
      date: '2020-05-25', 
      label: 'George Floyd Murder',
      icon: FaUserSlash,
      notes: "George Floyd, a black man, died while being arrested in Minneapolis, Minnesota. Floyd's death inspired months of protest against police brutality and racism and motivated ongoing discussions about racial justice and the role of race in American society.",
      position: 'above',
      color: '#0000FF' // Blue
    },
    { 
      date: '2020-11-03', 
      label: 'US Presidential Election',
      icon: FaVoteYea,
      notes: "The 2020 United States presidential election took place against the backdrop of a global pandemic. Joe Biden defeated incumbent Donald Trump in what became one of the most contested elections in US history.",
      position: 'above',
      color: '#0000FF' // Blue
    },
    { 
      date: '2021-01-06', 
      label: 'Capitol Riot',
      icon: GiCapitol,
      notes: "Supporters of President Trump stormed the United States Capitol in an attempt to overturn his defeat in the 2020 presidential election, leading to multiple deaths and widespread concern about the state of American democracy.",
      position: 'above',
      color: '#0000FF' // Blue
    },
    { 
      date: '2021-01-06', 
      label: 'Stop the Steal Rally',
      icon: FaGavel,
      notes: "A rally held in Washington, D.C., to protest the results of the 2020 presidential election, coinciding with the Capitol Riot.",
      position: 'below',
      color: '#FF0000' // Red
    },
    { 
      date: '2021-03-22', 
      label: 'Boulder Shooting',
      icon: FaStore,
      notes: "A mass shooting occurred at a King Soopers supermarket in Boulder, Colorado. Ten people were killed, including a local on-duty police officer.",
      position: 'above',
      color: '#0000FF' // Blue
    },
    { 
      date: '2021-09-01', 
      label: 'Texas SB 8',
      icon: FaGavel,
      notes: "Texas Senate Bill 8 (SB 8) banned abortions after approximately six weeks of pregnancy. It was unique in its enforcement mechanism, allowing private citizens to sue abortion providers or anyone who 'aids or abets' an abortion, rather than relying on state officials. This created a system where people could file lawsuits with the potential for financial rewards, leading to widespread concern and debate.",
      position: 'above',
      color: '#0000FF' // Blue
    }
  ];

  const [selectedGlyph] = useState(null);
  const [pendingStartDate, setPendingStartDate] = useState(localStartDate);
  const [pendingEndDate, setPendingEndDate] = useState(localEndDate);

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

    const margin = { left: 50, right: 30 };
    const width = dimensions.width - margin.left - margin.right;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const timeScale = d3.scaleTime()
      .domain([minDate.toDate(), maxDate.toDate()])
      .range([0, width])
      .clamp(true);

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, 20)`);

    // Draw timeline line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("stroke", "#666")
      .attr("stroke-width", 2);

    // Draw the selected range line
    const selectedRangeLine = g.append("line")
      .attr("class", "selected-range-line")
      .attr("stroke", "#605dff") // Use DaisyUI primary color
      .attr("stroke-width", 4);

    // Create a separate group for handles that will be rendered last
    const handlesGroup = g.append("g")
      .attr("class", "handles")
      .style("pointer-events", "all"); // Ensure handles receive events

    const updateSelectedRangeLine = () => {
      const startX = timeScale(pendingStartDate.toDate());
      const endX = timeScale(pendingEndDate.toDate());
      selectedRangeLine
        .attr("x1", startX)
        .attr("x2", endX);
    };

    // Updated glyph rendering
    importantDates.forEach(({ date, label, notes, icon: Icon, position, color }) => {
      // Create a container div for Tippy
      const container = document.createElement('div');
      container.className = `glyph-container-${date}`;
      container.style.position = 'absolute';
      container.style.left = `${timeScale(new Date(date)) + margin.left}px`;
      container.style.top = position === 'above' ? '6px' : '34px'; // Adjusted to sit just above or below timeline
      container.style.transform = 'translate(-50%, -50%)';
      container.style.zIndex = '1';
      containerRef.current.appendChild(container);

      // Create the tooltip content with HTML
      const tooltipContent = (
        <div className="bg-base-100 text-base-content border border-primary shadow-lg rounded-box p-4 w-[450px] space-y-2">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color }} />
            <h3 className="font-bold text-lg">{label}</h3>
          </div>
          <ul className="text-sm list-disc list-inside">
            {notes.split('. ').map((note, index) => (
              <li key={index}>
                {note.endsWith('.') ? note : `${note}.`}
              </li>
            ))}
          </ul>
        </div>
      );      

      // Render Tippy and glyph using React
      const root = ReactDOM.createRoot(container);
      root.render(
        <Tippy 
          content={tooltipContent}
          animation="scale-subtle"
          trigger="click"
          interactive={true}
          allowHTML={true}
          maxWidth={400}
          placement="top"
          onShow={(instance) => {
            document.querySelectorAll('[data-tippy-root]').forEach(tooltip => {
              const tippyInstance = tooltip._tippy;
              if (tippyInstance && tippyInstance !== instance) {
                tippyInstance.hide();
              }
            });
          }}
          popperOptions={{
            modifiers: [
              {
                name: 'preventOverflow',
                options: {
                  padding: 8, // how far from the edge of the screen
                  boundary: 'viewport', // default, but can also be 'clippingParents'
                },
              },
              {
                name: 'flip',
                options: {
                  fallbackPlacements: ['bottom', 'right', 'left'], // or just ['bottom']
                },
              },
            ],
          }}
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-base-300 border-2 border-primary cursor-pointer hover:bg-base-200 transition-colors" style={{ borderColor: color }}>
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
        </Tippy>
      );
    });

    // Add handles with tooltips
    const dragBehavior = d3.drag()
      .on("start", function() {
        const handle = d3.select(this);
        const isStart = handle.classed("start-handle");
        const date = timeScale.invert(+handle.attr("cx"));
        
        // Create or update tooltip
        if (!this._tippy) {
          tippy(this, {
            animation: 'scale-subtle',
            content: dayjs(date).format('MMM D, YYYY'),
            placement: 'top',
            showOnCreate: true,
          });
        }
      })
      .on("drag", function(event) {
        const handle = d3.select(this);
        const isStart = handle.classed("start-handle");
        
        // Clamp the x position to valid range
        const clampedX = Math.max(0, Math.min(width, event.x));
        const date = timeScale.invert(clampedX);
        // Inside drag handler, after you calculate `date`
        const newDate = dayjs(date);

        if (isStart) {
          if (newDate >= minDate && newDate < localEndDate) {
            handle.attr("cx", clampedX);
            setPendingStartDate(newDate); // ✅ live update while dragging
            this._tippy?.setContent(newDate.format('MMM D, YYYY'));
          }
        } else {
          if (newDate <= maxDate && newDate > localStartDate) {
            handle.attr("cx", clampedX);
            setPendingEndDate(newDate); // ✅ live update while dragging
            this._tippy?.setContent(newDate.format('MMM D, YYYY'));
          }
        }
        updateSelectedRangeLine();
      })
      .on("end", function(event) {
        const handle = d3.select(this);
        const isStart = handle.classed("start-handle");
        const clampedX = Math.max(0, Math.min(width, event.x));
        const date = timeScale.invert(clampedX);
        
        // Destroy tooltip
        if (this._tippy) {
          this._tippy.destroy();
        }
        
        // Apply changes with clamped values
        if (isStart) {
          const newDate = dayjs(date);
          if (newDate.isBefore(minDate)) {
            setLocalStartDate(minDate);
            onDateChange(minDate, localEndDate);
            handle.attr("cx", timeScale(minDate.toDate()));
          } else if (newDate.isBefore(localEndDate)) {
            setLocalStartDate(newDate);
            onDateChange(newDate, localEndDate);
          }
        } else {
          const newDate = dayjs(date);
          if (newDate.isAfter(maxDate)) {
            setLocalEndDate(maxDate);
            onDateChange(localStartDate, maxDate);
            handle.attr("cx", timeScale(maxDate.toDate()));
          } else if (newDate.isAfter(localStartDate)) {
            setLocalEndDate(newDate);
            onDateChange(localStartDate, newDate);
          }
        }
        updateSelectedRangeLine();
      });

    // Move handle creation to after glyphs, using the handlesGroup
    // Start handle
    handlesGroup.append("circle")
      .attr("class", "start-handle")
      .attr("cx", timeScale(localStartDate.toDate()))
      .attr("cy", 0)
      .attr("r", 8)
      .attr("fill", "#4B5563")
      .style("cursor", "ew-resize")
      .call(dragBehavior);

    // End handle
    handlesGroup.append("circle")
      .attr("class", "end-handle")
      .attr("cx", timeScale(localEndDate.toDate()))
      .attr("cy", 0)
      .attr("r", 8)
      .attr("fill", "#4B5563")
      .style("cursor", "ew-resize")
      .call(dragBehavior);

    updateSelectedRangeLine();

    // Cleanup function
    return () => {
      importantDates.forEach(({ date }) => {
        const container = document.querySelector(`.glyph-container-${date}`);
        if (container) {
          container.remove();
        }
      });
    };
  }, [dimensions, localStartDate, localEndDate]);

  // Update pending dates when props change
  useEffect(() => {
    setPendingStartDate(localStartDate);
    setPendingEndDate(localEndDate);
  }, [localStartDate, localEndDate]);

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
    <div ref={containerRef} className="relative w-full">
      <svg 
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="cursor-pointer"
        style={{ zIndex: '20' }}
      />
      
      {/* Callout for selected glyph */}
      {selectedGlyph && dimensions.width && (
        <div 
          className="absolute z-50 w-[450px] bg-base-200 shadow-lg rounded-lg p-4 border border-primary"
          style={{
            left: `${d3.scaleTime()
              .domain([minDate.toDate(), maxDate.toDate()])
              .range([0, dimensions.width - 80])(new Date(selectedGlyph)) + 50}px`,
            top: "-120px",
            transform: "translateX(-50%)"
          }}
        >
          <h3 className="font-bold text-lg mb-2">
            {importantDates.find(d => d.date === selectedGlyph)?.label}
          </h3>
          <p className="text-sm">
            {importantDates.find(d => d.date === selectedGlyph)?.notes}
          </p>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-4 h-4 bg-base-200 border-r border-b border-primary"></div>
        </div>
      )}
      
      {/* Date Input Fields */}
      <div className={`absolute left-12 -top-1 transition-opacity duration-150 ${isStartDateEditing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isStartDateEditing ? (
          <input
            type="date"
            className="date-input p-1 text-sm rounded border"
            value={pendingStartDate?.format('YYYY-MM-DD') || '2020-01-01'}
            min="2020-01-01"
            max="2021-12-31"
            onChange={(e) => {
              const newDate = dayjs(e.target.value);
              setPendingStartDate(newDate);
            }}
          />
        ) : (
          <button
            className="date-input flex items-center gap-2 bg-gray-700 px-2 py-1 rounded text-sm"
            onClick={() => setIsStartDateEditing(true)}
          >
            <FaCalendarAlt />
            {pendingStartDate?.format('MMM D, YYYY') || 'Jan 1, 2020'}
          </button>
        )}
      </div>

      <div className={`absolute right-12 -top-1 transition-opacity duration-150 ${isEndDateEditing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isEndDateEditing ? (
          <input
            type="date"
            className="date-input p-1 text-sm rounded border"
            value={pendingEndDate?.format('YYYY-MM-DD') || '2021-12-31'}
            min="2020-01-01"
            max="2021-12-31"
            onChange={(e) => {
              const newDate = dayjs(e.target.value);
              setPendingEndDate(newDate);
            }}
          />
        ) : (
          <button
            className="date-input flex items-center gap-2 bg-gray-700 px-2 py-1 rounded text-sm"
            onClick={() => setIsEndDateEditing(true)}
          >
            <FaCalendarAlt />
            {pendingEndDate?.format('MMM D, YYYY') || 'Dec 31, 2021'}
          </button>
        )}
      </div>
    </div>
  );
}

TimelineSlider.propTypes = {
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  onDateChange: PropTypes.func.isRequired
};

export default TimelineSlider; 