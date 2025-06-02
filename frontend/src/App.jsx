import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import dayjs from 'dayjs';
import Navbar from './components/Base/Navbar';
import Sidebar from './components/Base/Sidebar';
import SidebarAbout from './components/Base/SidebarAbout';
import SidebarInfo from './components/Base/SidebarInfo';
import TabbedCharts from './components/Base/TabbedCharts';
import BipartiteFlow from './components/Base/BipartiteFlow';
import './App.css';

const INITIAL_TOPICS = [
  'capitol',
  'immigra',
  'abortion',
  'blacklivesmatter',
  'climate',
  'gun',
  'rights',
  'covid',
];

export default function App() {
  // State from HEAD (Current Change)
  const [panel, setPanel] = useState('sidebar'); // Manages which panel is open
  const [topics, setTopics] = useState(INITIAL_TOPICS);
  const [startDate, setStartDate] = useState(dayjs('2020-01-01'));
  const [endDate, setEndDate] = useState(dayjs('2021-12-31'));
  const [metric, setMetric] = useState('posts'); // Renamed from selectedMetric for consistency with HEAD
  const [keyword, setKeyword] = useState('');
  const [legislator, setLegislator] = useState(null);
  const [clickedLegislators, setClickedLegislators] = useState([]); // From HEAD
  const [postData, setPostData] = useState([]);

  // State from Incoming Change to be integrated
  const [filters, setFilters] = useState({
    interactionType: "all",
    party: ["D", "R"],
    state: "all",
  });
  const [minCivility, setMinCivility] = useState(0.5);
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    civility: true,
    misinformation: true, // Assuming this was intended; if not, remove
    statistics: true,
    topics: true,
    metrics: true,
  });

  // Sync initial theme (from HEAD, slightly adapted variable name from Incoming)
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Panel toggle logic from HEAD
  const toggle = panelKey => setPanel(prev => (prev === panelKey ? null : panelKey));

  const sidebarOpen = panel === 'sidebar';
  const aboutOpen = panel === 'about';
  const infoOpen = panel === 'info';

  // Date change handler from HEAD
  const handleDateChange = (s, e) => {
    setStartDate(s);
    setEndDate(e);
  };

  // Filter change handler from Incoming
  const handleFilterChange = (type, value) => {
    setFilters((prev) => ({ ...prev, [type]: value }));
  };

  // Section toggle handler from Incoming
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar
        toggleSidebar={() => toggle('sidebar')}
        toggleAbout={() => toggle('about')}
        toggleInfo={() => toggle('info')}
      />
      <BrowserRouter>
        <div className="flex flex-grow mt-16 relative">
          {/* Sidebar rendering and animation from HEAD */}
          <aside
            className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-30 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full' // Ensuring it's fully off-screen
            }`}
          >
            <Sidebar
              // Props from HEAD
              activeTopics={topics}
              setActiveTopics={setTopics}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              selectedMetric={metric}
              setSelectedMetric={setMetric}
              keyword={keyword}
              setKeyword={setKeyword}
              legislator={legislator}
              setLegislator={setLegislator}
              filters={filters}
              handleFilterChange={handleFilterChange}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              minCivility={minCivility}
              setMinCivility={setMinCivility}
              sidebarOpen={sidebarOpen}
            />
          </aside>

          {/* SidebarAbout and SidebarInfo from HEAD's structure */}
          <SidebarAbout aboutOpen={aboutOpen} toggleAbout={() => toggle('about')} />
          <SidebarInfo infoOpen={infoOpen} toggleInfo={() => toggle('info')} />

          <main
            className={`flex-grow transition-margin duration-300 ease-in-out ${
              sidebarOpen || aboutOpen || infoOpen ? 'ml-64' : 'ml-0'
            }`}
          >
            <div className="grid grid-cols-5 gap-4 p-4 h-[calc(100vh-4rem)]">
              <section className="col-span-3 bg-base-200 rounded-lg shadow-lg overflow-hidden">
                <BipartiteFlow
                  activeTopics={topics}
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={handleDateChange}
                  selectedMetric={metric}
                  filters={filters}
                  minCivility={minCivility}
                />
              </section>

              <section className="col-span-2 bg-base-200 rounded-lg shadow-lg overflow-hidden">
                <TabbedCharts
                  legislatorClicked={clickedLegislators}
                  setLegislatorClicked={setClickedLegislators}
                  postData={postData}
                  setPostData={setPostData}
                  startDate={startDate}
                  endDate={endDate}
                  selectedTopics={topics}
                  selectedMetric={metric}
                  keyword={keyword}
                  legislator={legislator}
                  setLegislator={setLegislator}
                  filters={filters}
                  minCivility={minCivility}
                  activeTopics={topics}
                />
              </section>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}