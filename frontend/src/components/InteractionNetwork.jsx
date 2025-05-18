import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import moment from 'moment';

const REGION_STATE_MAP = {
  Northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  Midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
  South: ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'DC', 'WV', 'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX'],
  West: ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA']
};

function InteractionNetwork({ startDate, endDate, selectedTopics, selectedMetric, legislator }) {

  console.log("legislator selected",legislator)
  console.log("Function dates passed are,", startDate, endDate)
  
  const chartRef = useRef();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    party: ['D', 'R'],
    region: 'all',
    state: 'all',
    interactionType: 'all',
    minInteractions: 0
  });

  const [hoveredChord, setHoveredChord] = useState(null);
  const [pinnedChord, setPinnedChord] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const startDateSlider = moment('2020-01-01');
  const endDateSlider = moment('2021-12-31');
  const months = useMemo(() => {
    const arr = [];
    let current = startDateSlider.clone();
    while (current.isSameOrBefore(endDateSlider)) {
      arr.push(current.clone());
      current.add(1, 'month');
    }
    return arr;
  }, []);

  const findClosestMonthIndex = (targetDate) => {
    return months.findIndex(m => m.isSame(moment(targetDate), 'month'));
  };

  const [sliderRange, setSliderRange] = useState([0, months.length - 1]);


  useEffect(() => {
    if (!startDate || !endDate) return;
    
    const start = moment(startDate.$d || startDate);
    const end = moment(endDate.$d || endDate);
  
    const newStartIdx = findClosestMonthIndex(start);
    const newEndIdx = findClosestMonthIndex(end);
  
    if (newStartIdx !== -1 && newEndIdx !== -1) {
      setSliderRange([newStartIdx, newEndIdx]);
    }
  }, [startDate, endDate]);
  

  const selectedStartDate = months[sliderRange[0]];
  const selectedEndDate = months[sliderRange[1]];

  const handleMouseMove = (event) => {
    const container = chartRef.current.getBoundingClientRect();
    setMousePosition({ x: event.clientX - container.left, y: event.clientY - container.top });
  };

  const handleClick = () => {
    setPinnedChord(hoveredChord || null);
  };

  useEffect(() => {
    axios
      .get('/api/chord/interactions/')
      .then(({ data }) => setData(data))
      .catch(error => console.error("Error fetching interaction data:", error));
  }, []);


  useEffect(() => {
    if (!data || selectedTopics.length === 0) return;

      let linksToKeep = data.links;
      if (selectedTopics && selectedTopics.length > 0) {
        linksToKeep = linksToKeep.filter(link =>
          Array.isArray(link.topics) &&
          link.topics.some(t => selectedTopics.includes(t))
        );
      }

        const formattedStart = selectedStartDate.format('YYYY-MM-DD');
        const formattedEnd   = selectedEndDate.clone().endOf('month').format('YYYY-MM-DD');
        linksToKeep = linksToKeep.filter(link => {
          const linkDateOnly = moment(link.date).format('YYYY-MM-DD');
          return moment(linkDateOnly).isBetween(formattedStart, formattedEnd, undefined, '[]');
        });


   const connectedIds = new Set();
   linksToKeep.forEach(l => {
     connectedIds.add(l.source_legislator_id);
     connectedIds.add(l.target_legislator_id);
   });

   let nodesToKeep = data.nodes.filter(n =>
     connectedIds.has(n.legislator_id)
   );

    const legislatorId = legislator?.legislator_id;


    if (legislator && legislator !== 'all') {   
      const relevantLinks = linksToKeep.filter(link =>
        link.source_legislator_id === legislatorId ||
        link.target_legislator_id === legislatorId
      );    

      const legislatorIds = new Set();
      relevantLinks.forEach(lk => {
        legislatorIds.add(lk.source_legislator_id);
        legislatorIds.add(lk.target_legislator_id);
      });

      nodesToKeep = data.nodes.filter(node =>
        legislatorIds.has(node.legislator_id)
      );

      linksToKeep = relevantLinks;
    }


    const container = chartRef.current;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const margin = 100;
    const radius = Math.max(Math.min(width, height) / 2 - margin, 50);

    d3.select(container).selectAll('*').remove();

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .on('mousemove', handleMouseMove)
      .on('click', handleClick)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

      const filteredNodes = nodesToKeep.filter(node =>
        filters.party.includes(node.party) &&
        (filters.state === 'all' || node.state === filters.state)
      );
      

      const nodeIndexMap = Object.fromEntries(
        filteredNodes.map((node, i) => [node.legislator_id, i])
      );
      
    const n = filteredNodes.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    linksToKeep.forEach(link => {
      const src = nodeIndexMap[link.source_legislator_id];
      const tgt = nodeIndexMap[link.target_legislator_id];
      if (src !== undefined && tgt !== undefined) {
        const value = filters.interactionType === 'all' ? link.value : link[filters.interactionType];
        if (value >= filters.minInteractions) {
          matrix[src][tgt] = value;
          matrix[tgt][src] = value;
        }
      }
    });

    const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
    const color = d3.scaleOrdinal().domain(['D', 'R']).range(['#60A5FA', '#EF4444']);
    const arc = d3.arc().innerRadius(radius).outerRadius(radius + 20);

    const group = svg.append('g').selectAll('g').data(chord.groups).join('g');

    group.append('path')
      .attr('fill', d => color(filteredNodes[d.index].party))
      .attr('d', arc)
      .on('mouseover', (event, d) => !pinnedChord && setHoveredChord({ node: filteredNodes[d.index] }))
      .on('mouseout', () => !pinnedChord && setHoveredChord(null));

    group.append('text')
      .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .attr('transform', d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${radius + 60}) ${d.angle > Math.PI ? 'rotate(180)' : ''}
      `)
      .attr('text-anchor', d => d.angle > Math.PI ? 'end' : null)
      .text(d => filteredNodes[d.index].name)
      .style('fill', '#ffffff')
      .style('font-size', '14px');

    const ribbon = d3.ribbon().radius(radius);

    svg.append('g')
      .attr('fill-opacity', 0.67)
      .selectAll('path')
      .data(chord)
      .join('path')
      .attr('d', ribbon)
      .attr('fill', d => color(filteredNodes[d.source.index].party))
      .attr('stroke', d => d3.rgb(color(filteredNodes[d.source.index].party)).darker())
      .on('mouseover', (event, d) => {
        if (pinnedChord) return;
        const source = filteredNodes[d.source.index];
        const target = filteredNodes[d.target.index];
        const link = data.links.find(l =>
          (l.source === source.id && l.target === target.id) ||
          (l.source === target.id && l.target === source.id)
        );
        if (link) {
          setHoveredChord({
            source, target,
            interactions: {
              mention: link.mention,
              reply: link.reply,
              retweet: link.retweet,
              total: link.mention + link.reply + link.retweet
            }
          });
        }
      })
      .on('mouseout', () => !pinnedChord && setHoveredChord(null));
  }, [data, filters, pinnedChord, sliderRange, legislator, selectedTopics,selectedStartDate,selectedEndDate]);

  const getFilteredStates = () => {
    if (!data?.nodes) return [];
    if (filters.region === 'all') {
      return [...new Set(data?.nodes.map(n => n.state))].sort();
    }
    return REGION_STATE_MAP[filters.region] || [];
  };

  return (
    <div className="relative h-[750px] w-full">
      {/* Slider */}
      <div className="px-4 pb-6">
        <label className="text-base-content">
          Date Range: {selectedStartDate.format('MMM YYYY')} - {selectedEndDate.format('MMM YYYY')}
        </label>
        <Slider
          range
          min={0}
          max={months.length - 1}
          value={sliderRange}
          onChange={setSliderRange}
          marks={months.reduce((acc, m, i) => {
            if (i % 3 === 0) acc[i] = m.format('MM/YYYY');
            return acc;
          }, {})}
          step={1}
          allowCross={false}
        />
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 items-center mb-4 px-4 text-white">
        {/* Party Filter */}
        <div className="flex items-center gap-2">
          <span className='text-base-content'>Party:</span>
          {['D', 'R'].map(p => (
            <label key={p} className="text-base-content flex items-center gap-1">
              <input
                type="checkbox"
                checked={filters.party.includes(p)}
                onChange={e => {
                  setFilters(prev => ({
                    ...prev,
                    party: e.target.checked
                      ? [...prev.party, p]
                      : prev.party.filter(val => val !== p)
                  }));
                }}
              />
              {p === 'D' ? 'Democrat' : 'Republican'}
            </label>
          ))}
        </div>

        {/* Region Filter */}
        <div className="flex items-center gap-2">
          <span className='text-base-content'>Region:</span>
          <select
            value={filters.region}
            onChange={e => {
              setFilters(prev => ({ ...prev, region: e.target.value, state: 'all' }));
            }}
            className="text-base-content"
          >
            <option value="all">All</option>
            {Object.keys(REGION_STATE_MAP).map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>

        {/* State Filter */}
        <div className="flex items-center gap-2">
          <span className='text-base-content'>State:</span>
          <select
            value={filters.state}
            onChange={e => setFilters(prev => ({ ...prev, state: e.target.value }))}
            className="text-base-content"
          >
            <option value="all">All</option>
            {getFilteredStates().map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        {/* Interaction Type Filter */}
        <div className="flex items-center gap-2">
          <span className='text-base-content'>Type:</span>
          <select
            value={filters.interactionType}
            onChange={e => setFilters(prev => ({ ...prev, interactionType: e.target.value }))}
            className="text-base-content"
          >
            <option value="all">All</option>
            {['mention', 'reply', 'retweet'].map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chord Diagram */}
      <div ref={chartRef} className="h-full w-full" />
    </div>
  );
}

export default InteractionNetwork;