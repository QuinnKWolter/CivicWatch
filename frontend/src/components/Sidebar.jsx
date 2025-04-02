import React from 'react';
import dayjs from 'dayjs'

function Sidebar({ filters, handleFilterChange, expandedSections, toggleSection, minCivility, setMinCivility, activeTopics, setActiveTopics, startDate, setStartDate, endDate, setEndDate}) {
  return (
    <div className="fixed top-16 left-0 h-full overflow-y-auto bg-base-200 text-base-content z-20 w-64">
      <div className="p-4">
        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleSection('filters')}
          >
            Basic Filters
          </button>
          {expandedSections.filters && (
            <div className="mt-4">
              <label className="block text-base-content">Interaction Type</label>
              <select
                className="w-full bg-base-300 text-base-content p-2 rounded"
                value={filters.interactionType}
                onChange={(e) => handleFilterChange('interactionType', e.target.value)}
              >
                <option value="all">All Interactions</option>
                <option value="mentions">Mentions</option>
                <option value="replies">Replies</option>
                <option value="retweets">Retweets</option>
              </select>

              <label className="block text-base-content mt-4">Party</label>
              {['D', 'R'].map(party => (
                <div key={party} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.party.includes(party)}
                    onChange={(e) => {
                      const newParties = e.target.checked
                        ? [...filters.party, party]
                        : filters.party.filter(p => p !== party);
                      handleFilterChange('party', newParties);
                    }}
                    className="mr-2"
                  />
                  <span className="text-base-content">{party === 'D' ? 'Democrat' : 'Republican'}</span>
                </div>
              ))}

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
                  onChange={(e) => { console.log('DATE', dayjs(e.target.value)); setEndDate(dayjs(e.target.value)) }}
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
              {['topic1', 'topic2', 'topic3', 'topic4', 'topic5', 'topic6'].map(topic => (
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
                  <span className="text-base-content">Topic {topic.slice(-1)}</span>
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