import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import moment from 'moment';

const REGION_STATE_MAP = {
  Northeast: ['CT','ME','MA','NH','RI','VT','NJ','NY','PA'],
  Midwest:   ['IL','IN','MI','OH','WI','IA','KS','MN','MO','NE','ND','SD'],
  South:     ['DE','FL','GA','MD','NC','SC','VA','DC','WV','AL','KY','MS','TN','AR','LA','OK','TX'],
  West:      ['AZ','CO','ID','MT','NV','NM','UT','WY','AK','CA','HI','OR','WA']
};

function InteractionNetwork({ startDate, endDate, selectedTopics, selectedMetric, legislator }) {
  const tooltipRef = useRef();
  const chartRef   = useRef();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    party: ['D','R'], region: 'all', state: 'all',
    interactionType: 'all', minInteractions: 0
  });
  const [hoveredChord, setHoveredChord] = useState(null);
  const [pinnedChord, setPinnedChord]   = useState(null);

  useEffect(() => {
    if (!legislator || legislator === 'all') {
      setPinnedChord(null);
      setHoveredChord(null);
    }
  }, [legislator]);


  const startSlider = moment('2020-01-01');
  const endSlider   = moment('2021-12-31');
  const months = useMemo(() => {
    const m = []; let cur = startSlider.clone();
    while (cur.isSameOrBefore(endSlider)) { m.push(cur.clone()); cur.add(1,'month'); }
    return m;
  }, []);
  const findClosest = d => months.findIndex(m => m.isSame(moment(d), 'month'));
  const [sliderRange, setSliderRange] = useState([0, months.length-1]);
  useEffect(() => {
      if (!startDate || !endDate) return;
  const s = moment(startDate.$d || startDate);
  const e = moment(endDate.$d || endDate);

  const i0 = months.findIndex(m => m.isSame(s, 'month'));
  const i1 = months.findIndex(m => m.isSame(e, 'month'));
   if (i0>-1 && i1>-1) setSliderRange([i0, i1]);
 }, [startDate, endDate, months]);


  const selStart = months[sliderRange[0]];
  const selEnd   = months[sliderRange[1]];


  useEffect(() => {
    axios.get('/api/chord/interactions/')
      .then(res => setData(res.data))
      .catch(console.error);
  }, []);


  useEffect(() => {
    console.log('🔍 redraw: legislator prop is:', legislator);
   console.log('🔍 redraw: selectedTopics, sliderRange:', selectedTopics, sliderRange);

    if (!data || selectedTopics.length===0) return;

    // 1) filter links by topics + date
    let links = data.links.filter(l =>
      selectedTopics.some(t=>l.topics?.includes(t)) &&
      moment(l.date).isBetween(
        selStart.format('YYYY-MM-DD'),
        selEnd.clone().endOf('month').format('YYYY-MM-DD'),
        undefined,'[]'
      )
    );

    // 2) find nodes in any kept link
    const inIds = new Set();
    links.forEach(l => {
      inIds.add(l.source_legislator_id);
      inIds.add(l.target_legislator_id);
    });
    let nodes = data.nodes.filter(n => inIds.has(n.legislator_id));

    // // 3) if a specific legislator is pinned, further filter
      if (
        legislator !== null &&
        legislator !== undefined &&
        legislator !== 'all' &&
        typeof legislator === 'object' &&
        legislator.legislator_id
      ) {
      links = links.filter(l =>
        l.source_legislator_id===legislator.legislator_id ||
        l.target_legislator_id===legislator.legislator_id
      );
      const sub = new Set();
      links.forEach(l => {
        sub.add(l.source_legislator_id);
        sub.add(l.target_legislator_id);
      });
      nodes = nodes.filter(n => sub.has(n.legislator_id));
    }

    // 4) apply party + state filters, and drop self-links
    nodes = nodes.filter(n =>
      filters.party.includes(n.party) &&
      (filters.state==='all' || n.state===filters.state)
    );
    const nodeIndex = Object.fromEntries(nodes.map((n,i)=>[n.legislator_id,i]));
    links = links.filter(l =>
      nodeIndex[l.source_legislator_id]!=null &&
      nodeIndex[l.target_legislator_id]!=null &&
      l.source_legislator_id!==l.target_legislator_id
    );


   const still = new Set();
   links.forEach(l => {
     still.add(l.source_legislator_id);
     still.add(l.target_legislator_id);
   });
   nodes = nodes.filter(n => still.has(n.legislator_id));
   const prunedIndex = Object.fromEntries(nodes.map((n,i)=>[n.legislator_id,i]));
   Object.assign(nodeIndex, prunedIndex);

    // 5) build directed matrix
    const N = nodes.length;
    const matrix = Array.from({length:N},()=>Array(N).fill(0));
    links.forEach(l => {
      const i = nodeIndex[l.source_legislator_id];
      const j = nodeIndex[l.target_legislator_id];
      const v = filters.interactionType==='all'
        ? l.value : l[filters.interactionType];
      if (v >= filters.minInteractions) {
        matrix[i][j] += v;
      }
    });

    // 6) set up SVG & dimensions
    const container = chartRef.current;
    const W = container.offsetWidth;
    const H = container.offsetHeight;
    const margin = 100;
    const r = Math.max(Math.min(W,H)/2 - margin, 50);
    d3.select(container).selectAll('*').remove();
    const svg = d3.select(container)
      .append('svg')
        .attr('width', W)
        .attr('height', H)
      .append('g')
        .attr('transform', `translate(${W/2},${H/2})`);

    // 7) define a fat arrowhead marker
    svg.append('defs').append('marker')
      .attr('id','arrowhead')
      .attr('viewBox','-10 -5 20 10')
      .attr('refX', r + 10)
      .attr('refY', 0)
      .attr('markerUnits','userSpaceOnUse')
      .attr('markerWidth', 20)
      .attr('markerHeight',20)
      .attr('orient','auto')
      .append('path')
        .attr('d','M -10,-5 L 10,0 L -10,5 Z')
        .attr('fill','currentColor');        

    // 8) compute directed chord layout
    const chord = d3.chordDirected()
      .padAngle(12 / r)               
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending)
      (matrix);

    const color = d3.scaleOrdinal()
      .domain(['D','R'])
      .range(['#60A5FA','#EF4444']);
    const arc = d3.arc().innerRadius(r).outerRadius(r+20);

    // 9) draw outer arcs & labels
    const group = svg.append('g')
      .selectAll('g')
      .data(chord.groups)
      .join('g');

    group.append('path')
      .classed('chord-arc', true) 
      .attr('fill', d => color(nodes[d.index].party))
      .attr('d', arc)
      .attr('marker-end', null)
      .on('mouseover', (_,d) => {
        if (!pinnedChord) setHoveredChord({ node: nodes[d.index] });
      })
      .on('mouseout', () => {
        if (!pinnedChord) setHoveredChord(null);
      })
      .attr('marker-end', null);

    group.append('text')
      .each(d => d.angle = (d.startAngle + d.endAngle)/2)
      .attr('dy','.35em')
      .attr('transform', d => `
        rotate(${(d.angle * 180/Math.PI - 90)})
        translate(${r + 40}) ${d.angle > Math.PI ? 'rotate(180)' : ''}
      `)
      .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
      .text(d => nodes[d.index].name)
      .style('fill','#fff')
      .style('font-size','12px');



    const ribbon = d3.ribbonArrow()
      .padAngle(1 / r)
      .radius(r - 0.5);


    svg.append('g')
      .attr('fill-opacity', 0.75)
      .selectAll('path')
      .data(chord)
      .join('path')
        .attr('d', ribbon)                                  
        .attr('fill', d => color(nodes[d.source.index].party))
        .attr('stroke', d => d3.rgb(color(nodes[d.source.index].party)).darker())
        .attr('stroke-width', 1)

        .on('mouseover', (event, d) => {
          const src = nodes[d.source.index], tgt = nodes[d.target.index];
          const raw = data.links.find(l =>
            l.source_legislator_id===src.legislator_id &&
            l.target_legislator_id===tgt.legislator_id
          );
          setHoveredChord({
            source: src,
            target: tgt,
            interactions: raw ? {
              mention: raw.mention,
              reply:   raw.reply,
              retweet: raw.retweet,
              total:   raw.mention + raw.reply + raw.retweet
            } : null
          });

          tooltipRef.current.style.display = 'block';
          const { left, top } = chartRef.current.getBoundingClientRect();
          tooltipRef.current.style.left = `${event.clientX - left + 10}px`;
          tooltipRef.current.style.top  = `${event.clientY - top  + 10}px`;
          tooltipRef.current.innerHTML = `
            <strong>${src.name}</strong> → <strong>${tgt.name}</strong><br/>
            Topics: ${raw?.topics?.join(', ') || 'none'}
          `;
        })
        .on('mousemove', event => {
          const { left, top } = chartRef.current.getBoundingClientRect();
          tooltipRef.current.style.left = `${event.clientX - left + 10}px`;
          tooltipRef.current.style.top  = `${event.clientY - top  + 10}px`;
        })
        .on('mouseout', () => {
          if (!pinnedChord) setHoveredChord(null);
          tooltipRef.current.style.display = 'none';
        })
        .on('click', (event, d) => {
          const clickNode = nodes[d.source.index];
          setPinnedChord(prev =>
            prev?.node?.legislator_id === clickNode.legislator_id
              ? null
              : { node: clickNode }
          );
        });

  }, [
    data, filters, pinnedChord,
    sliderRange, legislator,
    selectedTopics, selStart, selEnd
  ]);

 
  const getFilteredStates = () => {
    if (!data?.nodes) return [];
    if (filters.region==='all') {
      return [...new Set(data.nodes.map(n=>n.state))].sort();
    }
    return REGION_STATE_MAP[filters.region] || [];
  };

  return (
    <div className="relative h-[750px] w-full">
      {/* Date slider */}
      <div className="px-4 pb-6">
        <label>
          Date Range: {selStart.format('MMM YYYY')} – {selEnd.format('MMM YYYY')}
        </label>
        <Slider
          range
          min={0}
          max={months.length-1}
          value={sliderRange}
          onChange={setSliderRange}
          marks={months.reduce((m,d,i)=>{
            if (i%3===0) m[i]=d.format('MM/YYYY');
            return m;
          },{})}
          step={1}
          allowCross={false}
        />
      </div>

      {/* Filters (party, region, state, type) */}
      <div className="flex flex-wrap gap-4 items-center mb-4 px-4 text-white">
        {/* Party */}
        <div className="flex gap-2 items-center">
          <span>Party:</span>
          {['D','R'].map(p=>(
            <label key={p} className="flex gap-1 items-center">
              <input
                type="checkbox"
                checked={filters.party.includes(p)}
                onChange={e=>
                  setFilters(f=>({
                    ...f,
                    party: e.target.checked
                      ? [...f.party, p]
                      : f.party.filter(x=>x!==p)
                  }))
                }
              />
              {p==='D'?'Democrat':'Republican'}
            </label>
          ))}
        </div>
        {/* Region */}
        <div className="flex gap-2 items-center">
          <span>Region:</span>
          <select
            value={filters.region}
            onChange={e=>
              setFilters(f=>({ ...f, region:e.target.value, state:'all' }))
            }
          >
            <option value="all">All</option>
            {Object.keys(REGION_STATE_MAP).map(r=>(
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        {/* State */}
        <div className="flex gap-2 items-center">
          <span>State:</span>
          <select
            value={filters.state}
            onChange={e=>setFilters(f=>({ ...f, state:e.target.value }))}
          >
            <option value="all">All</option>
            {getFilteredStates().map(s=>(
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {/* Interaction Type */}
        <div className="flex gap-2 items-center">
          <span>Type:</span>
          <select
            value={filters.interactionType}
            onChange={e=>setFilters(f=>({ ...f, interactionType:e.target.value }))}
          >
            <option value="all">All</option>
            {['mention','reply','retweet'].map(t=>(
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tooltip container */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          display: 'none',
          zIndex: 10
        }}
      />

      {/* Chord diagram */}
      <div ref={chartRef} className="h-full w-full" />
    </div>
  );
}

export default InteractionNetwork;
