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
  const [panel, setPanel] = useState('sidebar');

  const [topics, setTopics] = useState(INITIAL_TOPICS);
  const [startDate, setStartDate] = useState(dayjs('2020-01-01'));
  const [endDate, setEndDate] = useState(dayjs('2021-12-31'));
  const [metric, setMetric] = useState('posts');
  const [keyword, setKeyword] = useState('');
  const [legislator, setLegislator] = useState(null);

  const [clickedLegislators, setClickedLegislators] = useState([]);
  const [postData, setPostData] = useState([]);

  // Sync initial theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggle = key => setPanel(prev => (prev === key ? null : key));

  const sidebarOpen = panel === 'sidebar';
  const aboutOpen = panel === 'about';
  const infoOpen = panel === 'info';

  const handleDateChange = (s, e) => {
    setStartDate(s);
    setEndDate(e);
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
          <aside
            className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-30 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-64'
            }`}
          >
            <Sidebar
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
            />
          </aside>

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
                />
              </section>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}