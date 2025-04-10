import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom'
import BipartiteFlow from './components/BipartiteFlow';
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
  const [activeTopics, setActiveTopics] = useState([
    'abortion', 
    'blacklivesmatter', 
    'capitol',
    'climate', 
    'covid', 
    'gun', 
    'immigra', 
    'rights'
  ]);
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

  const handleDateChange = (newStart, newEnd) => {
    setStartDate(newStart);
    setEndDate(newEnd);
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-grow mt-16">
        <BrowserRouter>
          <div className="flex flex-grow relative">
            <div 
              className={`fixed top-16 h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out z-30
                ${sidebarOpen ? 'left-0' : '-left-64'}`}
            >
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
                sidebarOpen={sidebarOpen}
              />
            </div>

            <div 
              className={`flex-grow transition-all duration-300 ease-in-out
                ${sidebarOpen ? 'ml-64' : 'ml-0'}`}
            >
              <div className="grid grid-cols-5 gap-4 p-4 h-[calc(100vh-4rem)]">
                <div className="col-span-2 bg-base-200 rounded-lg shadow-lg overflow-hidden">
                  <TabbedCharts
                    legislatorClicked={legislatorClicked}
                    setLegislatorClicked={setLegislatorClicked}
                    postData={postData}
                    setPostData={setPostData}
                    startDate={startDate}
                    endDate={endDate}
                    activeTopics={activeTopics} 
                  />
                </div>
                <div className="col-span-3 bg-base-200 rounded-lg shadow-lg overflow-hidden">
                  <BipartiteFlow 
                    activeTopics={activeTopics} 
                    startDate={startDate} 
                    endDate={endDate} 
                    onDateChange={handleDateChange}
                  />
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