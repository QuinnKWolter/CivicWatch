import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom'
import BipartiteFlow from './components/BipartiteFlow';
import InteractionNetwork from './components/InteractionNetwork';
import Sidebar from './components/Sidebar';
import TabbedCharts from './components/TabbedCharts';
import Navbar from './components/Navbar';
import './App.css'
import dayjs from 'dayjs'

function App() {
  const [filters, setFilters] = useState({
    interactionType: 'all',
    party: ['D', 'R'],
    state: 'all'
  });
  const [minCivility, setMinCivility] = useState(0.5);
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    civility: true,
    misinformation: true,
    statistics: true,
    topics: true
  });
  const [activeTopics, setActiveTopics] = useState(['topic1', 'topic2', 'topic3', 'topic4', 'topic5', 'topic6']);
  const [startDate, setStartDate] = useState(dayjs('2020-01-01'));
  const [endDate, setEndDate] = useState(dayjs('2022-01-01'));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleFilterChange = (type, value) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const[legislatorClicked, setLegislatorClicked] = useState([]);
  const[postData, setPostData] = useState([]);

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  console.log('setLegislatorClicked from props:', setLegislatorClicked);

  return (
    <div className="flex flex-col h-screen">
      <Navbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-grow mt-16">
        <BrowserRouter>
          <div className="flex flex-grow">
            {sidebarOpen && (
              <div className="w-64 bg-base-300 overflow-hidden">
                <Sidebar
                  filters={filters}
                  handleFilterChange={handleFilterChange}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  minCivility={minCivility}
                  setMinCivility={setMinCivility}
                  activeTopics={activeTopics}
                  setActiveTopics={setActiveTopics}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                />
              </div>
            )}
            <div className="flex-grow flex flex-col">
              <div className="flex-grow grid grid-cols-2 gap-4 p-4 w-full">
                <div className="flex flex-col space-y-4">
                  <div className="flex-1">
                    <TabbedCharts
                      legislatorClicked={legislatorClicked}
                      setLegislatorClicked={setLegislatorClicked}
                      postData={postData}
                      setPostData={setPostData}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <BipartiteFlow activeTopics={activeTopics} />
                </div>
              </div>
            </div>
          </div>
        </BrowserRouter>
      </div>
    </div>
  )
}

export default App