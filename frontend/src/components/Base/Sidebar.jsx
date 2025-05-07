import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs'
import { colorMap, topicIcons } from '../../utils/utils';

function Sidebar({ filters, handleFilterChange, expandedSections, toggleSection, activeTopics, setActiveTopics, startDate, setStartDate, endDate, setEndDate, sidebarOpen, selectedMetric, setSelectedMetric, keyword, setKeyword, legislator, setLegislator }) {
  const [legislators, setLegislators] = useState([]);
  const [flashpoint, setFlashpoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize expandedSections with all sections expanded
  const [localExpandedSections, setLocalExpandedSections] = useState({
    flashpoints: true,
    legislators: true,
    keywords: true,
    topics: true,
    metrics: true,
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const fetchLegislators = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/legislators/');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setLegislators(data);
    } catch (error) {
      console.error('Error fetching legislators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLegislatorSelect = (legislator) => {
    setLegislator(legislator);
    setSearchTerm(`${legislator.name} (${legislator.party.charAt(0)} - ${legislator.state})`);
    setDropdownOpen(false);
  };

  const filteredLegislators = legislators.filter(legislator =>
    legislator.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const flashpoints = [
  { label: 'January 6th Insurrection', dateRange: ['2021-01-06', '2021-01-31'] },
    { label: '2020 BLM Protests', dateRange: ['2020-05-25', '2020-07-31'] },
    // Add more flashpoints as needed
  ];

  const handleFlashpointChange = (event) => {
    const selected = flashpoints.find(fp => fp.label === event.target.value);
    if (selected) {
      setStartDate(dayjs(selected.dateRange[0]));
      setEndDate(dayjs(selected.dateRange[1]));
      // Adjust other selections if needed
    }
    setFlashpoint(event.target.value);
  };

  const toggleLocalSection = (section) => {
    setLocalExpandedSections(prevState => ({
      ...prevState,
      [section]: !prevState[section],
    }));
  };

  return (
    <div className="w-64 h-full bg-base-200 shadow-xl overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleLocalSection('flashpoints')}
          >
            Date Settings
          </button>
          {localExpandedSections.flashpoints && (
            <div className="mt-4">
              <label className="block text-base-content">Flashpoints</label>
              <select
                className="select select-bordered w-full"
                value={flashpoint}
                onChange={handleFlashpointChange}
              >
                <option value="">Select a key event</option>
                {flashpoints.map(fp => (
                  <option key={fp.label} value={fp.label}>{fp.label}</option>
                ))}
              </select>

              <label className="block text-base-content mt-4">Date Range</label>
              <input
                type="date"
                className="w-full bg-base-300 text-base-content p-2 m-1 rounded"
                value={dayjs(startDate).format('YYYY-MM-DD')}
                onChange={(e) => setStartDate(dayjs(e.target.value))}
              />
              <br />
              <input
                type="date"
                className="w-full bg-base-300 text-base-content p-2 m-1 rounded"
                value={dayjs(endDate).format('YYYY-MM-DD')}
                onChange={(e) => setEndDate(dayjs(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleLocalSection('legislators')}
          >
            Select Legislator
          </button>
          {localExpandedSections.legislators && (
            <div className="mt-4">
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Search legislator"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => {
                    if (legislators.length === 0) fetchLegislators();
                    setDropdownOpen(true);
                  }}
                  onClick={() => setDropdownOpen(true)}
                />
                {dropdownOpen && (
                  <ul className="absolute z-10 w-full bg-base-200 border border-base-300 rounded mt-1 max-h-60 overflow-y-auto">
                    {loading ? (
                      <li className="p-2 text-center">Loading...</li>
                    ) : (
                      filteredLegislators.map(legislator => (
                        <li
                          key={legislator.legislator_id}
                          className="p-2 hover:bg-base-300 cursor-pointer"
                          onClick={() => handleLegislatorSelect(legislator)}
                        >
                          {legislator.name} ({legislator.party.charAt(0)} - {legislator.state})
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleLocalSection('keywords')}
          >
            Keyword Search
          </button>
          {localExpandedSections.keywords && (
            <div className="mt-4">
              <input
                type="text"
                className="input input-bordered w-full"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleLocalSection('topics')}
          >
            Topic Settings
          </button>
          {localExpandedSections.topics && (
            <div className="mt-4">
              <label className="block text-base-content">Topics</label>
              {['capitol', 'immigra', 'abortion', 'blacklivesmatter', 'climate', 'gun', 'rights', 'covid'].map(topic => {
                const Icon = topicIcons[topic];
                return (
                  <div key={topic} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={activeTopics.includes(topic)}
                        onChange={(e) => {
                          const newTopics = e.target.checked
                            ? [...activeTopics, topic]
                            : activeTopics.filter(t => t !== topic);
                          setActiveTopics(newTopics);
                        }}
                        className="checkbox checkbox-primary mr-2 mb-1"
                      />
                      <Icon className="mr-2" />
                      <span className="text-base-content">{topic.charAt(0).toUpperCase() + topic.slice(1)}</span>
                    </div>
                    <div className="flex">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[topic]?.D }}></div>
                      <div className="w-3 h-3 rounded-full ml-1" style={{ backgroundColor: colorMap[topic]?.R }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleLocalSection('metrics')}
          >
            Metric Settings
          </button>
          {localExpandedSections.metrics && (
            <div className="mt-4">
              <label className="block text-base-content">Select Metric</label>
              <div className="flex flex-col space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="metric"
                    value="posts"
                    checked={selectedMetric === 'posts'}
                    onChange={() => setSelectedMetric('posts')}
                    className="radio radio-primary mr-2"
                  />
                  Posts
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="metric"
                    value="legislators"
                    checked={selectedMetric === 'legislators'}
                    onChange={() => setSelectedMetric('legislators')}
                    className="radio radio-primary mr-2"
                  />
                  Legislators
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="metric"
                    value="engagement"
                    checked={selectedMetric === 'engagement'}
                    onChange={() => setSelectedMetric('engagement')}
                    className="radio radio-primary mr-2"
                  />
                  Engagement
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar; 