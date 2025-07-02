import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { colorMap, topicIcons } from '../../utils/utils';

// Constants
const FLASHPOINTS = [
  { label: 'January 6th Insurrection', range: ['2021-01-05', '2021-01-31'] },
  { label: '2020 BLM Protests', range: ['2020-05-24', '2020-07-31'] },
];
const TOPICS = Object.keys(topicIcons);
const METRICS = [
  { value: 'posts', label: 'Posts' },
  { value: 'legislators', label: 'Legislators' },
  { value: 'engagement', label: 'Engagement' },
];

export default function Sidebar({
  activeTopics,
  setActiveTopics,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMetric,
  setSelectedMetric,
  keyword,
  setKeyword,
  legislator,
  setLegislator,
}) {
  const [legislators, setLegislators] = useState([]);
  const [flashpoint, setFlashpoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef();
  const [inputValue, setInputValue] = useState('');
  const [sections, setSections] = useState({
    flashpoints: true,
    legislators: true,
    keywords: true,
    topics: true,
    metrics: true,
  });

  // Debounce keyword input
  useEffect(() => {
    const id = setTimeout(() => setKeyword(inputValue), 2000);
    return () => clearTimeout(id);
  }, [inputValue, setKeyword]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Fetch legislators
  const fetchLegislators = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/legislators/');
      if (!res.ok) throw new Error();
      setLegislators(await res.json());
    } catch {
      console.error('Failed to fetch legislators');
    } finally {
      setLoading(false);
    }
  };

  // Keep searchTerm in sync
  useEffect(() => {
    if (legislator) {
      const { name, party, state } = legislator;
      setSearchTerm(`${name} (${party.charAt(0)} - ${state})`);
    }
  }, [legislator]);

  const handleSelect = leg => {
    setLegislator(leg);
    setSearchTerm(`${leg.name} (${leg.party.charAt(0)} - ${leg.state})`);
    setDropdownOpen(false);
  };

  const filtered = legislators.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSection = key =>
    setSections(s => ({ ...s, [key]: !s[key] }));

  return (
    <aside className="w-64 h-full bg-base-200 shadow-xl overflow-y-auto p-4 space-y-4">
      <Section
        title="Date Settings"
        open={sections.flashpoints}
        onToggle={() => toggleSection('flashpoints')}
      >
        <label className="block">Flashpoints</label>
        <select
          className="select select-bordered w-full"
          value={flashpoint}
          onChange={e => {
            const fp = FLASHPOINTS.find(f => f.label === e.target.value);
            if (fp) {
              setStartDate(dayjs(fp.range[0]));
              setEndDate(dayjs(fp.range[1]));
            }
            setFlashpoint(e.target.value);
          }}
        >
          <option value="">Select a key event</option>
          {FLASHPOINTS.map(fp => (
            <option key={fp.label} value={fp.label}>
              {fp.label}
            </option>
          ))}
        </select>
        <label className="block mt-4">Date Range</label>
        <input
          type="date"
          className="input input-bordered w-full"
          value={dayjs(startDate).format('YYYY-MM-DD')}
          onChange={e => setStartDate(dayjs(e.target.value))}
        />
        <input
          type="date"
          className="input input-bordered w-full mt-2"
          value={dayjs(endDate).format('YYYY-MM-DD')}
          onChange={e => setEndDate(dayjs(e.target.value))}
        />
      </Section>

      <Section
        title="Select Legislator"
        open={sections.legislators}
        onToggle={() => toggleSection('legislators')}
      >
        <div className="relative" ref={dropdownRef}>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Search legislator"
            value={searchTerm}
            onChange={e => {
                   const v = e.target.value;
                   setSearchTerm(v);
                   if (v === '') {
                     setLegislator(null);
                     setDropdownOpen(false);
                   }
                 }}
            onFocus={() => {
              if (!legislators.length) fetchLegislators();
              setDropdownOpen(true);
            }}
          />
          {dropdownOpen && (
            <ul className="absolute z-10 w-full bg-base-200 border rounded mt-1 max-h-60 overflow-y-auto">
              {loading ? (
                <li className="p-2 text-center">Loading...</li>
              ) : (
                        
                       
                filtered.map(leg => (
                  <li
                    key={leg.legislator_id}
                    className="p-2 hover:bg-base-300 cursor-pointer"
                    onClick={() => handleSelect(leg)}
                  >
                    {leg.name} ({leg.party.charAt(0)} - {leg.state})
                  </li>
                ))
                        
                         
              ) }
            </ul>
          )}
        </div>
      </Section>

      <Section
        title="Keyword Search"
        open={sections.keywords}
        onToggle={() => toggleSection('keywords')}
      >
        <input
          type="text"
          className="input input-bordered w-full"
          value={inputValue}
          onChange={e => {
            const v = e.target.value;
            setInputValue(v);
            if (v.trim() === '') {
              setKeyword(null);
            }
          }}
        />
      </Section>

      <Section
        title="Topic Settings"
        open={sections.topics}
        onToggle={() => toggleSection('topics')}
      >
        {TOPICS.filter(topic => topic !== 'all').map(topic => {
          const Icon = topicIcons[topic];
          return (
            <div key={topic} className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={activeTopics.includes(topic)}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...activeTopics, topic]
                      : activeTopics.filter(t => t !== topic);
                    setActiveTopics(next);
                  }}
                  className="checkbox checkbox-primary mr-2"
                />
                <Icon className="mr-2" />
                {topic.charAt(0).toUpperCase() + topic.slice(1)}
              </label>
              <div className="flex">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colorMap[topic]?.D }}
                />
                <span
                  className="w-3 h-3 rounded-full ml-1"
                  style={{ backgroundColor: colorMap[topic]?.R }}
                />
              </div>
            </div>
          );
        })}
      </Section>

      <Section
        title="Metric Settings"
        open={sections.metrics}
        onToggle={() => toggleSection('metrics')}
      >
        {METRICS.map(m => (
          <label key={m.value} className="flex items-center">
            <input
              type="radio"
              name="metric"
              value={m.value}
              checked={selectedMetric === m.value}
              onChange={() => setSelectedMetric(m.value)}
              className="radio radio-primary mr-2"
            />
            {m.label}
          </label>
        ))}
      </Section>
    </aside>
  );
}

function Section({ title, open, onToggle, children }) {
  return (
    <div>
      <button
        className="w-full bg-primary text-primary-content py-2 rounded"
        onClick={onToggle}
      >
        {title}
      </button>
      {open && <div className="mt-4 space-y-2">{children}</div>}
    </div>
  );
}