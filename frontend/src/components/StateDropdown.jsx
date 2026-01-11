import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { API_BASE } from '../utils/api';

export default function StateDropdown({
  selectedState,
  setSelectedState,
  selectedParty = 'both',
  // eslint-disable-next-line no-unused-vars
  selectedPlatform = 'both',
}) {
  const [allStates, setAllStates] = useState([]);
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const stateDropdownRef = useRef();

  // Load states from API
  useEffect(() => {
    const loadStates = async () => {
      setLoading(true);
      try {
        const params = {};
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }

        const queryString = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/states/?${queryString}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setAllStates(data);
      } catch (error) {
        console.error('Error loading states:', error);
        setAllStates([]);
      } finally {
        setLoading(false);
      }
    };

    loadStates();
  }, [selectedParty]);

  // States don't need filtering by party/platform for now (could be added later)
  const states = allStates;

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target)) {
        setStateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleStateSelect = (state) => {
    setSelectedState(state.abbr);
    setStateDropdownOpen(false);
    setStateSearchTerm('');
  };

  const handleClear = () => {
    setSelectedState('');
    setStateSearchTerm('');
  };

  const filteredStates = states.filter((state) =>
    state.abbr?.toLowerCase().includes(stateSearchTerm.toLowerCase()) ||
    state.name?.toLowerCase().includes(stateSearchTerm.toLowerCase())
  );

  const selectedStateName = states.find((s) => s.abbr === selectedState)?.name || selectedState;

  return (
    <div className="relative" ref={stateDropdownRef}>
      <Tippy
        content={
          selectedState ? (
            <div className="text-center">
              <div className="font-semibold text-sm mb-1">State Filter</div>
              <div className="text-xs mb-2">{selectedStateName}</div>
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
              handleClear();
            } else {
              setStateDropdownOpen(!stateDropdownOpen);
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
              <span className="text-sm font-bold transition-opacity duration-300 group-hover:opacity-0">
                {selectedState}
              </span>
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
        <div
          className="absolute z-50 w-80 bg-base-200 border rounded-lg shadow-xl mt-2 max-h-60 overflow-y-auto"
          style={{ 
            left: '50%',
            transform: 'translateX(-50%)',
            top: '100%'
          }}
        >
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2">Select State</div>
            <input
              type="text"
              className="input input-bordered input-sm w-full mb-2"
              placeholder="Search states..."
              value={stateSearchTerm}
              onChange={(e) => setStateSearchTerm(e.target.value)}
            />
            {loading ? (
              <div className="p-2 text-center text-sm">Loading...</div>
            ) : filteredStates.length === 0 ? (
              <div className="p-2 text-center text-sm text-gray-500">No states found</div>
            ) : (
              filteredStates.map((state) => (
                <div
                  key={state.abbr}
                  className="p-2 hover:bg-base-300 cursor-pointer text-sm"
                  onClick={() => handleStateSelect(state)}
                >
                  {state.abbr} - {state.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

StateDropdown.propTypes = {
  selectedState: PropTypes.string.isRequired,
  setSelectedState: PropTypes.func.isRequired,
  selectedParty: PropTypes.string,
  selectedPlatform: PropTypes.string,
};

