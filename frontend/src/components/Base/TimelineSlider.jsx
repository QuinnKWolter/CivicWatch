import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaVirus, FaVoteYea, FaGavel, FaUserSlash, FaStore, FaSkullCrossbones, FaVideo, FaMapMarkedAlt, FaDemocrat, FaRepublican, FaTwitter } from 'react-icons/fa';
import { GiCapitol } from 'react-icons/gi';
import { WiThermometer } from 'react-icons/wi';
import { TbPodium } from 'react-icons/tb';
import ReactDOM from 'react-dom/client';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import tippy from 'tippy.js';
import 'tippy.js/animations/scale-subtle.css';
import { colorMap } from '../../utils/utils';

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
      date: '2020-03-03',
      label: 'Super Tuesday',
      icon: FaMapMarkedAlt,
      notes: "Super Tuesday, held on March 3, 2020, was a pivotal day in the Democratic presidential primaries. Voters in fourteen states cast their ballots, resulting in significant delegate wins for Joe Biden, solidifying his position as a frontrunner. Bernie Sanders also won delegates, but the day marked a turning point in the race.",
      color: colorMap.capitol,
      position: "above"
    },
    { 
      date: '2020-03-13', 
      label: 'COVID Emergency Declaration',
      icon: FaVirus,
      notes: "President Trump declared a national emergency concerning the COVID-19 outbreak, freeing up $50 billion in federal funding and establishing public-private partnerships to expand testing capabilities.",
      color: colorMap.covid,
      position: "below"
    },
    {
      date: '2020-05-25', 
      label: "George Floyd's Death",
      icon: FaUserSlash,
      notes: "George Floyd, a black man, died while being arrested in Minneapolis, Minnesota. Floyd's death inspired months of protest against police brutality and racism and motivated ongoing discussions about racial justice and the role of race in American society.",
      color: colorMap.blacklivesmatter,
      position: "above"
    },
    {
      date: '2020-05-27',
      label: 'US Reaches 100,000 COVID Deaths',
      icon: FaSkullCrossbones,
      notes: "On May 27, 2020, the United States reached 100,000 deaths due to the COVID-19 pandemic. Less than a year later, by May 16, 2022, the nation would surpass the 1,000,000 deaths milestone, highlighting the devastating and rapid spread of the virus.",
      color: colorMap.covid,
      position: "below"
    },
    {
      date: '2020-08-17',
      label: 'Democratic National Convention (Day 1)',
      icon: FaDemocrat,
      notes: "The Democratic National Convention commenced virtually on August 17, 2020, due to the COVID-19 pandemic. The first day featured speakers highlighting party values and formally nominating Joe Biden as the Democratic candidate for president and Kamala Harris as the vice-presidential nominee.",
      color: colorMap.capitol,
      position: "above"
    },
    {
      date: '2020-08-24',
      label: 'Republican National Convention (Day 1)',
      icon: FaRepublican,
      notes: "The Republican National Convention began virtually on August 24, 2020, also adapting to the COVID-19 pandemic. The first day included speakers supporting President Donald Trump's renomination and outlining the Republican platform for the upcoming election.",
      color: colorMap.capitol,
      position: "below"
    },
    {
      date: '2020-09-01',
      label: 'August/September 2020 US Heatwave',
      icon: WiThermometer,
      notes: "August and September 2020 saw a significant and widespread heatwave across parts of the United States, particularly impacting the West Coast. This event contributed to already dangerous conditions fueled by historic wildfires in states like California, Oregon, and Washington. The intense heatwave served as a stark reminder of the increasing frequency and intensity of extreme weather events linked to climate change.",
      color: colorMap.climate,
      position: "above"
    },
    {
      date: '2020-09-29',
      label: 'First Presidential Debate',
      icon: TbPodium,
      notes: "The first presidential debate was marked by frequent interruptions and a chaotic atmosphere. Trump repeatedly interrupted Biden, leading to contentious exchanges. Biden criticized Trump's COVID-19 response and handling of the economy. Trump defended his record and attacked Biden's family. Discussions on healthcare, climate change, and racial justice were often overshadowed by the candidates' combative interactions.",
      color: colorMap.capitol,
      position: "below"
    },
    {
      date: '2020-10-22',
      label: 'Final Presidential Debate',
      icon: TbPodium,
      notes: `Biden critiqued Trump's COVID-19 response and advocated for progressive stances on immigration, abortion, racial justice, climate change, and gun control. Trump defended his pandemic handling, border security, anti-abortion stance, law enforcement, and Second Amendment rights, while raising voter fraud concerns. Overall, the debate featured more focused policy discussions than the first, with clear contrasts between the candidates' positions.`,
      color: colorMap.capitol,
      position: "above"
    },
    { 
      date: '2020-11-03', 
      label: 'US Presidential Election',
      icon: FaVoteYea,
      notes: "The 2020 United States presidential election took place against the backdrop of a global pandemic. Joe Biden defeated incumbent Donald Trump in what became one of the most contested elections in US history.",
      color: colorMap.capitol,
      position: "below"
    },
    { 
      date: '2021-01-06', 
      label: 'January 6th Capitol Attack',
      icon: GiCapitol,
      notes: "Supporters of President Trump stormed the United States Capitol in an attempt to overturn his defeat in the 2020 presidential election, leading to multiple deaths and widespread concern about the state of American democracy.",
      color: colorMap.capitol,
      position: "above"
    },
    {
      date: '2021-01-08',
      label: 'Twitter Suspends Trump\'s Account',
      icon: FaTwitter,
      notes: "On January 8, 2021, Twitter suspended President Donald Trump's account, citing the risk of further incitement of violence following the January 6th Capitol attack. This action by a major social media platform sparked widespread debate about free speech, censorship, and the power of tech companies.",
      color: colorMap.capitol,
      position: "below"
    },
    { 
      date: '2021-03-22', 
      label: 'Boulder Shooting',
      icon: FaStore,
      notes: "A mass shooting occurred at a King Soopers supermarket in Boulder, Colorado. Ten people were killed, including a local on-duty police officer.",
      color: colorMap.gun,
      position: "above"
    },
    {
      date: '2021-04-15',
      label: 'Release of Adam Toledo Shooting Footage',
      icon: FaVideo,
      notes: "On April 15, 2021, body camera footage was released depicting the fatal shooting of 13-year-old Adam Toledo by a Chicago police officer on March 29, 2021. The footage revealed Toledo had his hands raised and was unarmed, contradicting initial police accounts and sparking widespread protests and calls for police accountability, further fueling BLM activism online.",
      color: colorMap.blacklivesmatter,
      position: "below"
    },
    {
      date: '2021-04-20',
      label: 'Derek Chauvin Guilty Verdict',
      icon: FaGavel,
      notes: "On April 20, 2021, Derek Chauvin, the former Minneapolis police officer, was found guilty on all three charges in the murder of George Floyd. The verdict, delivered after weeks of testimony and months of anticipation, sparked widespread reactions on social media, with many expressing relief and a renewed call for systemic change, while others voiced concerns about the future of policing and justice.",
      color: colorMap.blacklivesmatter,
      position: "above"
    },
    { 
      date: '2021-09-01', 
      label: 'Texas SB 8',
      icon: FaGavel,
      notes: "Texas Senate Bill 8 (SB 8) banned abortions after approximately six weeks of pregnancy. It was unique in its enforcement mechanism, allowing private citizens to sue abortion providers or anyone who 'aids or abets' an abortion, rather than relying on state officials. This created a system where people could file lawsuits with the potential for financial rewards, leading to widespread concern and debate.",
      color: colorMap.abortion,
      position: "below"
    }
  ].filter(event => event.color !== colorMap.capitol.R);

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
      const startX = timeScale(localStartDate.toDate());
      const endX = timeScale(localEndDate.toDate());
      selectedRangeLine
        .attr("x1", startX)
        .attr("x2", endX);
    };

    updateSelectedRangeLine();

    // Updated glyph rendering
    importantDates.forEach(({ date, label, notes, icon: Icon, color, position }) => {
      // Create a container div for Tippy
      const container = document.createElement('div');
      container.className = `glyph-container-${date}`;
      container.style.position = 'absolute';
      container.style.left = `${timeScale(new Date(date)) + margin.left}px`;
      container.style.top = position === "above" ? '6px' : '34px'; // Adjust position based on the "position" field
      container.style.transform = 'translate(-50%, -50%)';
      containerRef.current.appendChild(container);

      // Create the tooltip content with HTML
      const tooltipContent = (
        <div className="p-4 w-[450px] space-y-2">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color: `linear-gradient(to right, ${color.D}, ${color.R})` }} />
            <h3 className="font-bold text-lg">{label}</h3>
          </div>
          <div className="text-sm text-gray-500">{dayjs(date).format('MMM D, YYYY')}</div>
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
          interactive={true}
          allowHTML={true}
          maxWidth={450} // Ensure this matches the content width
          placement={position === "above" ? "top" : "bottom"} // Adjust tooltip placement
          appendTo={() => document.body}
          popperOptions={{
            strategy: 'fixed',
            modifiers: [
              {
                name: 'preventOverflow',
                options: {
                  padding: 8,
                  boundary: 'viewport',
                },
              },
              {
                name: 'flip',
                options: {
                  fallbackPlacements: ['bottom', 'right', 'left', 'top'],
                },
              },
            ],
          }}
          zIndex={99999}
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-base-300 border-2 border-primary cursor-pointer hover:bg-base-200 transition-colors" style={{ borderColor: `linear-gradient(to right, ${color.D}, ${color.R})` }}>
            <Icon className="w-3 h-3" style={{ color: `linear-gradient(to right, ${color.D}, ${color.R})` }} />
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
            appendTo: document.body,
            popperOptions: { strategy: 'fixed' },
            zIndex: 99999,
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
            setPendingStartDate(newDate);
            this._tippy?.setContent(newDate.format('MMM D, YYYY'));
          }
        } else {
          if (newDate <= maxDate && newDate > localStartDate) {
            handle.attr("cx", clampedX);
            setPendingEndDate(newDate);
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

  useEffect(() => {
    // Initialize tooltips on elements with data-tippy-content
    tippy('[data-tippy-content]', {
      theme: 'light',
      placement: 'top',
      arrow: true,
      zIndex: 99999, // Ensure tooltips have a high z-index
      appendTo: document.body, // Append tooltips to the body to avoid stacking context issues
    });
  }, [importantDates]); // Re-run when importantDates changes

  return (
    <div ref={containerRef} className="relative w-full">
      <svg 
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="cursor-pointer"
      />
      
      {/* Callout for selected glyph */}
      {selectedGlyph && dimensions.width && (
        <div 
          className="absolute w-[450px] bg-base-200 shadow-lg rounded-lg p-4 border border-primary"
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