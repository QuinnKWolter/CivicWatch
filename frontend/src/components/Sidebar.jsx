import React from 'react';
import dayjs from 'dayjs'

function Sidebar({ filters, handleFilterChange, expandedSections, toggleSection, minCivility, setMinCivility, activeTopics, setActiveTopics, startDate, setStartDate, endDate, setEndDate, sidebarOpen }) {
  return (
    <div className="w-64 h-full bg-base-200 shadow-xl overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleSection('filters')}
          >
            Basic Filters
          </button>
          {expandedSections.filters && (
            <div className="mt-4">
              <label className="block text-base-content mt-4">Date Range (From, To)</label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  className="w-full bg-base-300 text-base-content p-2 rounded"
                  value={dayjs(startDate).format('YYYY-MM-DD')}
                  onChange={(e) => setStartDate(dayjs(e.target.value))}
                />
                <input
                  type="date"
                  className="w-full bg-base-300 text-base-content p-2 rounded"
                  value={dayjs(endDate).format('YYYY-MM-DD')}
                  onChange={(e) => setEndDate(dayjs(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleSection('civility')}
          >
            Civility Settings
          </button>
          {expandedSections.civility && (
            <div className="mt-4">
              <label className="block text-base-content">Minimum Civility Score</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minCivility}
                onChange={(e) => setMinCivility(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleSection('misinformation')}
          >
            Misinformation Settings
          </button>
          {expandedSections.misinformation && (
            <div className="mt-4">
              <div className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-base-content">Show Misinformation Flags</span>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" className="mr-2" />
                <span className="text-base-content">Hide High-Risk Connections</span>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleSection('topics')}
          >
            Topic Settings
          </button>
          {expandedSections.topics && (
            <div className="mt-4">
              <label className="block text-base-content">Topics</label>
              {['abortion', 'blacklivesmatter', 'climate', 'gun', 'immigra', 'rights'].map(topic => (
                <div key={topic} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={activeTopics.includes(topic)}
                    onChange={(e) => {
                      const newTopics = e.target.checked
                        ? [...activeTopics, topic]
                        : activeTopics.filter(t => t !== topic);
                      setActiveTopics(newTopics);
                    }}
                    className="mr-2"
                  />
                  <span className="text-base-content">{topic.charAt(0).toUpperCase() + topic.slice(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar; 