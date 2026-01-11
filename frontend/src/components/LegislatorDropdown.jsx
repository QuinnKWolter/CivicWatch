import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaUser, FaTimes } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { API_BASE } from '../utils/api';

export default function LegislatorDropdown({
  legislator,
  setLegislator,
  selectedParty = 'both',
  selectedState = '',
  // selectedPlatform = 'both', // Platform filtering not yet implemented for static data
}) {
  const [allLegislators, setAllLegislators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef();

  // Load legislators from API
  useEffect(() => {
    const loadLegislators = async () => {
      setLoading(true);
      try {
        const params = {};
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }
        if (selectedState) {
          params.state = selectedState;
        }

        const queryString = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/legislators/?${queryString}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setAllLegislators(data);
      } catch (error) {
        console.error('Error loading legislators:', error);
        setAllLegislators([]);
      } finally {
        setLoading(false);
      }
    };

    loadLegislators();
  }, [selectedParty, selectedState]);

  // Filter legislators based on selected filters
  const legislators = allLegislators.filter(leg => {
    if (selectedParty !== 'both' && leg.party !== selectedParty) {
      return false;
    }
    if (selectedState && leg.state !== selectedState) {
      return false;
    }
    // Platform filtering would require additional data, skip for now
    return true;
  });

  // Keep searchTerm in sync with selected legislator
  useEffect(() => {
    if (legislator) {
      const { name, party, state } = legislator;
      setSearchTerm(`${name} (${party?.charAt(0) || '?'} - ${state || 'N/A'})`);
    } else {
      setSearchTerm('');
    }
  }, [legislator]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSelect = (leg) => {
    setLegislator(leg);
    setSearchTerm(`${leg.name} (${leg.party.charAt(0)} - ${leg.state})`);
    setDropdownOpen(false);
  };

  const handleClear = () => {
    setLegislator(null);
    setSearchTerm('');
  };

  // Filter legislators client-side for immediate feedback
  const filtered = legislators.filter((l) =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.party?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
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
              handleClear();
            } else {
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
                <div className="text-[10px] leading-tight">
                  ({legislator.party?.charAt(0) || '?'} - {legislator.state || 'N/A'})
                </div>
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
        <div
          className="absolute z-50 w-80 bg-base-200 border rounded-lg shadow-xl mt-2 max-h-60 overflow-y-auto"
          style={{ 
            left: '50%',
            transform: 'translateX(-50%)',
            top: '100%'
          }}
        >
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2">Search Legislator</div>
            <input
              type="text"
              className="input input-bordered input-sm w-full mb-2"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {loading ? (
              <div className="p-2 text-center text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-2 text-center text-sm text-gray-500">No legislators found</div>
            ) : (
              filtered.map((leg) => (
                <div
                  key={leg.legislator_id}
                  className="p-2 hover:bg-base-300 cursor-pointer text-sm"
                  onClick={() => handleSelect(leg)}
                >
                  {leg.name} ({leg.party?.charAt(0) || '?'} - {leg.state || 'N/A'})
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

LegislatorDropdown.propTypes = {
  legislator: PropTypes.shape({
    name: PropTypes.string,
    party: PropTypes.string,
    state: PropTypes.string,
    legislator_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  setLegislator: PropTypes.func.isRequired,
  selectedParty: PropTypes.string,
  selectedState: PropTypes.string,
  selectedPlatform: PropTypes.string,
};

