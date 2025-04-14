import React from 'react';
import dayjs from 'dayjs'
import { colorMap } from './BipartiteFlow';

function Sidebar({ filters, handleFilterChange, expandedSections, toggleSection, activeTopics, setActiveTopics, startDate, setStartDate, endDate, setEndDate, sidebarOpen, selectedMetric, setSelectedMetric }) {
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
                <input
                  type="date"
                  className="w-full bg-base-300 text-base-content p-2 m-1 rounded"
                  value={dayjs(startDate).format('YYYY-MM-DD')}
                  onChange={(e) => setStartDate(dayjs(e.target.value))}
                />
                <br/>
                <input
                  type="date"
                  className="w-full bg-base-300 text-base-content p-2 m-1 rounded"
                  value={dayjs(endDate).format('YYYY-MM-DD')}
                  onChange={(e) => setEndDate(dayjs(e.target.value)) }
                />
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
              {['abortion', 'blacklivesmatter', 'capitol', 'climate', 'covid', 'gun', 'immigra', 'rights'].map(topic => (
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
                    <span className="text-base-content">{topic.charAt(0).toUpperCase() + topic.slice(1)}</span>
                  </div>
                  <div className="flex">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[topic]?.D }}></div>
                    <div className="w-3 h-3 rounded-full ml-1" style={{ backgroundColor: colorMap[topic]?.R }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <button
            className="w-full bg-primary text-primary-content py-2 rounded"
            onClick={() => toggleSection('metrics')}
          >
            Metric Settings
          </button>
          {expandedSections.metrics && (
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
                  Amount of Posts
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
                  Amount of Legislators
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
                  Amount of Engagement
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