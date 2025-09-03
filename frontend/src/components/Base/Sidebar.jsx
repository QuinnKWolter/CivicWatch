import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { FaUser, FaMapMarkerAlt, FaTimes, FaSearch, FaCalendarAlt } from 'react-icons/fa';
import { FaDemocrat, FaRepublican, FaArrowsAltH } from 'react-icons/fa';
import { FaTwitter, FaFacebook } from 'react-icons/fa';
import { colorMap, topicIcons } from '../../utils/utils';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

// Constants
const FLASHPOINTS = [
  { label: 'January 6th Insurrection', range: ['2021-01-05', '2021-01-31'] },
  { label: '2020 BLM Protests', range: ['2020-05-24', '2020-07-31'] },
];
const TOPICS = Object.keys(topicIcons).filter(topic => topic !== 'all');
const STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' }
];

const PARTY_OPTIONS = [
  { value: 'D', label: 'Democrats', icon: FaDemocrat, color: '#1f77b4' },
  { value: 'both', label: 'Both', icon: FaArrowsAltH, color: '#605DFF' },
  { value: 'R', label: 'Republicans', icon: FaRepublican, color: '#fb2c36' }
];

const PLATFORM_OPTIONS = [
  { value: 'twitter', label: 'Twitter', icon: FaTwitter, color: '#1DA1F2' },
  { value: 'both', label: 'Both', icon: FaArrowsAltH, color: '#605DFF' },
  { value: 'facebook', label: 'Facebook', icon: FaFacebook, color: '#1877F2' }
];

export default function Sidebar({
  activeTopics,
  setActiveTopics,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  keyword,
  setKeyword,
  legislator,
  setLegislator,
  selectedState,
  setSelectedState,
  selectedParty,
  setSelectedParty,
  selectedPlatform,
  setSelectedPlatform,
}) {
  const [legislators, setLegislators] = useState([]);
  const [flashpoint, setFlashpoint] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [keywordDropdownOpen, setKeywordDropdownOpen] = useState(false);
  const dropdownRef = useRef();
  const stateDropdownRef = useRef();
  const dateDropdownRef = useRef();
  const keywordDropdownRef = useRef();
  const [inputValue, setInputValue] = useState('');

  // Initialize default topics (first 5) if none are selected
  useEffect(() => {
    if (activeTopics.length === 0) {
      const defaultTopics = TOPICS.slice(0, 5);
      setActiveTopics(defaultTopics);
    }
  }, [activeTopics.length, setActiveTopics]);

  // Check if current date range is the default
  const isDefaultDateRange = () => {
    const defaultStart = dayjs('2020-01-01');
    const defaultEnd = dayjs('2023-12-31');
    return startDate.isSame(defaultStart, 'day') && endDate.isSame(defaultEnd, 'day');
  };

  // Debounce keyword input
  useEffect(() => {
    const id = setTimeout(() => setKeyword(inputValue), 2000);
    return () => clearTimeout(id);
  }, [inputValue, setKeyword]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target)) {
        setStateDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setDateDropdownOpen(false);
      }
      if (keywordDropdownRef.current && !keywordDropdownRef.current.contains(e.target)) {
        setKeywordDropdownOpen(false);
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

  const handleStateSelect = state => {
    setSelectedState(state.abbr);
    setStateDropdownOpen(false);
  };

  const filteredStates = STATES.filter(state =>
    state.abbr.toLowerCase().includes(stateSearchTerm.toLowerCase()) ||
    state.name.toLowerCase().includes(stateSearchTerm.toLowerCase())
  );

  const filtered = legislators.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Clear all filters
  const clearAllFilters = () => {
    setActiveTopics([]);
    setStartDate(dayjs('2020-01-01'));
    setEndDate(dayjs('2023-12-31'));
    setKeyword(null);
    setLegislator(null);
    setSelectedState('');
    setSelectedParty('both');
    setSelectedPlatform('both');
    setSearchTerm('');
    setInputValue('');
    setFlashpoint('');
  };

  // Get active filters for display
  const getActiveFilters = () => {
    const filters = [];
    
    if (activeTopics.length > 0) {
      const topicLabels = activeTopics.map(topic => topic.charAt(0).toUpperCase() + topic.slice(1));
      filters.push({ type: 'topics', label: `Topics: ${topicLabels.join(', ')}`, value: activeTopics });
    }
    if (keyword) {
      filters.push({ type: 'keyword', label: `Keyword: "${keyword}"`, value: keyword });
    }
    if (legislator) {
      filters.push({ type: 'legislator', label: `Legislator: ${legislator.name}`, value: legislator });
    }
    if (selectedState) {
      const stateName = STATES.find(s => s.abbr === selectedState)?.name || selectedState;
      filters.push({ type: 'state', label: `State: ${stateName}`, value: selectedState });
    }
    if (selectedParty !== 'both') {
      const partyOption = PARTY_OPTIONS.find(p => p.value === selectedParty);
      filters.push({ type: 'party', label: `Party: ${partyOption?.label || selectedParty}`, value: selectedParty });
    }
    if (selectedPlatform !== 'both') {
      const platformOption = PLATFORM_OPTIONS.find(p => p.value === selectedPlatform);
      filters.push({ type: 'platform', label: `Platform: ${platformOption?.label || selectedPlatform}`, value: selectedPlatform });
    }
    if (startDate && endDate && !isDefaultDateRange()) {
      const startStr = dayjs(startDate).format('MM/DD/YYYY');
      const endStr = dayjs(endDate).format('MM/DD/YYYY');
      filters.push({ type: 'date', label: `Date: ${startStr} to ${endStr}`, value: { startDate, endDate } });
    }
    
    return filters;
  };

  const activeFilters = getActiveFilters();

  return (
    <aside className="w-64 h-full bg-base-200 shadow-xl p-4 relative flex flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* Party Toggle */}
        <div className="space-y-3">
          <div className="flex bg-base-300 rounded-lg p-1">
            {PARTY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = selectedParty === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedParty(option.value)}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md transition-all duration-300 ${
                    isActive 
                      ? 'bg-base-100 shadow-sm' 
                      : 'hover:bg-base-200'
                  }`}
                  style={{
                    backgroundColor: isActive ? option.color + '33' : 'transparent',
                    color: isActive ? option.color : option.color + '66'
                  }}
                >
                  <div className={`flex items-center transition-all duration-300 ${
                    isActive ? 'space-x-2' : 'justify-center'
                  }`}>
                    <Icon 
                      size={isActive ? 16 : 14} 
                      className="transition-all duration-300"
                    />
                    {isActive && (
                      <span className="text-xs font-medium whitespace-nowrap">
                        {option.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Toggle */}
        <div className="space-y-3">
          <div className="flex bg-base-300 rounded-lg p-1">
            {PLATFORM_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = selectedPlatform === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedPlatform(option.value)}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md transition-all duration-300 ${
                    isActive 
                      ? 'bg-base-100 shadow-sm' 
                      : 'hover:bg-base-200'
                  }`}
                  style={{
                    backgroundColor: isActive ? option.color + '33' : 'transparent',
                    color: isActive ? option.color : option.color + '66'
                  }}
                >
                  <div className={`flex items-center transition-all duration-300 ${
                    isActive ? 'space-x-2' : 'justify-center'
                  }`}>
                    <Icon 
                      size={isActive ? 16 : 14} 
                      className="transition-all duration-300"
                    />
                    {isActive && (
                      <span className="text-xs font-medium whitespace-nowrap">
                        {option.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range and Keyword Search Bubbles */}
        <div className="space-y-3">
          <div className="flex justify-center space-x-4">
            {/* Date Range Bubble */}
            <div className="relative" ref={dateDropdownRef}>
              <Tippy
                content={
                  !isDefaultDateRange() ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Date Range</div>
                      <div className="text-xs mb-2">
                        {dayjs(startDate).format('MMM D, YYYY')} to {dayjs(endDate).format('MMM D, YYYY')}
                      </div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Date Range</div>
                      <div className="text-xs mb-2">Full dataset range</div>
                      <div className="text-xs text-gray-400">Click to Select Date Range</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => {
                    if (!isDefaultDateRange()) {
                      // Clear date back to default
                      setStartDate(dayjs('2020-01-01'));
                      setEndDate(dayjs('2023-12-31'));
                      setFlashpoint('');
                    } else {
                      setDateDropdownOpen(!dateDropdownOpen);
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    !isDefaultDateRange()
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                                  {!isDefaultDateRange() ? (
                  <div className="relative group">
                    <div className="text-xs text-center leading-tight px-1 transition-opacity duration-300 group-hover:opacity-0">
                      <div className="font-bold">{dayjs(startDate).format('MM/DD')}</div>
                      <div>{dayjs(endDate).format('MM/DD')}</div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <FaTimes size={20} />
                    </div>
                  </div>
                  ) : (
                    <FaCalendarAlt size={20} />
                  )}
                </button>
              </Tippy>
              {dateDropdownOpen && (
                <div className="absolute z-50 w-80 bg-base-200 border rounded mt-2 p-4" style={{ left: '-80px' }}>
                  <div className="text-xs text-gray-500 mb-3">Date Range</div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1 text-xs"
                        value={dayjs(startDate).format('YYYY-MM-DD')}
                        onChange={e => setStartDate(dayjs(e.target.value))}
                      />
                      <span className="text-xs text-gray-500">to</span>
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1 text-xs"
                        value={dayjs(endDate).format('YYYY-MM-DD')}
                        onChange={e => setEndDate(dayjs(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Keyword Search Bubble */}
            <div className="relative" ref={keywordDropdownRef}>
              <Tippy
                content={
                  keyword ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Keyword Search</div>
                      <div className="text-xs mb-2">"{keyword}"</div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Keyword Search</div>
                      <div className="text-xs mb-2">Search for specific terms</div>
                      <div className="text-xs text-gray-400">Click to Select Keywords</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => setKeywordDropdownOpen(!keywordDropdownOpen)}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    keyword 
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                  {keyword ? (
                    <div className="relative group">
                      <div className="text-xs text-center leading-tight px-1 transition-opacity duration-300 group-hover:opacity-0">
                        <div className="truncate">{keyword.length > 8 ? keyword.substring(0, 8) + '...' : keyword}</div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FaTimes size={20} />
                      </div>
                    </div>
                  ) : (
                    <FaSearch size={20} />
                  )}
                </button>
              </Tippy>
              {keywordDropdownOpen && (
                <div className="absolute z-50 w-80 bg-base-200 border rounded mt-2 p-4" style={{ left: '-80px' }}>
                  <div className="text-xs text-gray-500 mb-3">Keyword Search</div>
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      className="input input-bordered w-full pl-10"
                      placeholder="Enter keywords..."
                      value={inputValue}
                      onChange={e => {
                        const v = e.target.value;
                        setInputValue(v);
                        if (v.trim() === '') {
                          setKeyword(null);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* State and Legislator Selection */}
        <div className="space-y-3">
          <div className="flex justify-center space-x-4">
            {/* State Bubble */}
            <div className="relative" ref={stateDropdownRef}>
              <Tippy
                content={
                  selectedState ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">State Filter</div>
                      <div className="text-xs mb-2">{STATES.find(s => s.abbr === selectedState)?.name || selectedState}</div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">State Filter</div>
                      <div className="text-xs mb-2">Filter by state</div>
                      <div className="text-xs text-gray-400">Click to Select State</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => {
                    if (selectedState) {
                      setSelectedState('');
                    } else {
                      setStateDropdownOpen(!stateDropdownOpen);
                    }
                  }}
                  onMouseEnter={() => {
                    if (selectedState) {
                      // Show hover state for deselection
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    selectedState 
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                  {selectedState ? (
                    <div className="relative group">
                      <span className="text-sm font-bold transition-opacity duration-300 group-hover:opacity-0">{selectedState}</span>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FaTimes size={20} />
                      </div>
                    </div>
                  ) : (
                    <FaMapMarkerAlt size={20} />
                  )}
                </button>
              </Tippy>
              {stateDropdownOpen && (
                <div className="absolute z-50 w-96 bg-base-200 border rounded mt-2 max-h-60 overflow-y-auto" style={{ left: '-160px' }}>
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2">Select State</div>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full mb-2"
                      placeholder="Search states..."
                      value={stateSearchTerm}
                      onChange={e => setStateSearchTerm(e.target.value)}
                    />
                    {filteredStates.map(state => (
                      <div
                        key={state.abbr}
                        className="p-2 hover:bg-base-300 cursor-pointer text-sm"
                        onClick={() => handleStateSelect(state)}
                      >
                        {state.abbr} - {state.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Legislator Bubble */}
            <div className="relative" ref={dropdownRef}>
              <Tippy
                content={
                  legislator ? (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Legislator Filter</div>
                      <div className="text-xs mb-2">{legislator.name}</div>
                      <div className="text-xs text-gray-400">Click to Clear Selection</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="font-semibold text-sm mb-1">Legislator Filter</div>
                      <div className="text-xs mb-2">Filter by specific legislator</div>
                      <div className="text-xs text-gray-400">Click to Select Legislator</div>
                    </div>
                  )
                }
                placement="bottom"
                arrow
                animation="scale-subtle"
              >
                <button
                  onClick={() => {
                    if (legislator) {
                      setLegislator(null);
                      setSearchTerm('');
                    } else {
                      if (!legislators.length) fetchLegislators();
                      setDropdownOpen(!dropdownOpen);
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    legislator 
                      ? 'border-primary bg-primary text-primary-content hover:border-error hover:bg-error' 
                      : 'border-gray-300 bg-base-100 hover:border-primary hover:bg-primary hover:text-primary-content'
                  }`}
                >
                  {legislator ? (
                    <div className="relative group">
                      <div className="text-xs text-center leading-tight px-1 transition-opacity duration-300 group-hover:opacity-0">
                        <div className="font-bold leading-tight">{legislator.name.split(' ')[0]}</div>
                        <div className="leading-tight">{legislator.name.split(' ').slice(1).join(' ')}</div>
                        <div className="text-[10px] leading-tight">({legislator.party.charAt(0)} - {legislator.state})</div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FaTimes size={20} />
                      </div>
                    </div>
                  ) : (
                    <FaUser size={20} />
                  )}
                </button>
              </Tippy>
              {dropdownOpen && (
                <div className="absolute z-50 w-96 bg-base-200 border rounded mt-2 max-h-60 overflow-y-auto" style={{ left: '-160px' }}>
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2">Search Legislator</div>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full mb-2"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {loading ? (
                      <div className="p-2 text-center text-sm">Loading...</div>
                    ) : (
                      filtered.map(leg => (
                        <div
                          key={leg.legislator_id}
                          className="p-2 hover:bg-base-300 cursor-pointer text-sm"
                          onClick={() => handleSelect(leg)}
                        >
                          {leg.name} ({leg.party.charAt(0)} - {leg.state})
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OR Key Events Section */}
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2">OR</div>
            <select
              className="select select-bordered select-sm w-full text-xs bg-base-100"
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
          </div>
        </div>

        {/* Topic Selection - Redesigned */}
        <div className="space-y-3">
          <div className="text-xs text-gray-500 font-medium">Topics</div>
          <div className="max-h-120 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-2 pb-2">
              {TOPICS.map(topic => {
                const Icon = topicIcons[topic];
                const isActive = activeTopics.includes(topic);
                const color = colorMap[topic]?.color || '#6B7280';
                
                return (
                  <button
                    key={topic}
                    onClick={() => {
                      const next = isActive
                        ? activeTopics.filter(t => t !== topic)
                        : [...activeTopics, topic];
                      setActiveTopics(next);
                    }}
                    className={`relative p-3 rounded-lg border-2 transition-all duration-300 flex items-center space-x-2 ${
                      isActive 
                        ? 'border-current shadow-md' 
                        : 'border-gray-200 hover:border-gray-300 bg-base-100 hover:bg-base-200'
                    }`}
                    style={{
                      color: isActive ? color : '#6B7280',
                      backgroundColor: isActive ? color + '15' : 'transparent'
                    }}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {topic.charAt(0).toUpperCase() + topic.slice(1)}
                    </span>
                    {isActive && (
                      <div 
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Section - Fixed to bottom */}
      {activeFilters.length > 0 && (
        <div className="mt-auto pt-4 border-t border-gray-300">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Active Filters</h3>
              <button
                onClick={clearAllFilters}
                className="text-xs text-primary hover:text-primary-focus"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2">
              {activeFilters.map((filter, index) => (
                <div key={index} className="flex items-center justify-between bg-base-300 rounded px-3 py-2">
                  <span className="text-xs truncate">{filter.label}</span>
                  <button
                    onClick={() => {
                      switch (filter.type) {
                        case 'topics':
                          setActiveTopics([]);
                          break;
                        case 'keyword':
                          setKeyword(null);
                          setInputValue('');
                          break;
                        case 'legislator':
                          setLegislator(null);
                          setSearchTerm('');
                          break;
                        case 'state':
                          setSelectedState('');
                          break;
                        case 'party':
                          setSelectedParty('both');
                          break;
                        case 'platform':
                          setSelectedPlatform('both');
                          break;
                        case 'date':
                          setStartDate(dayjs('2020-01-01'));
                          setEndDate(dayjs('2023-12-31'));
                          setFlashpoint('');
                          break;
                      }
                    }}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}