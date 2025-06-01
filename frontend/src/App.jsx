import React, { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import BipartiteFlow from "./components/Base/BipartiteFlow";
import Sidebar from "./components/Base/Sidebar";
import SidebarAbout from "./components/Base/SidebarAbout";
import SidebarInfo from "./components/Base/SidebarInfo";
import TabbedCharts from "./components/Base/TabbedCharts";
import Navbar from "./components/Base/Navbar";
import "./App.css";
import dayjs from "dayjs";

function App() {
  const [filters, setFilters] = useState({
    interactionType: "all",
    party: ["D", "R"],
    state: "all",
  });
  const [minCivility, setMinCivility] = useState(0.5);
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    civility: true,
    misinformation: true,
    statistics: true,
    topics: true,
    metrics: true,
  });
  const [activeTopics, setActiveTopics] = useState([
    "capitol",
    "immigra",
    "abortion",
    "blacklivesmatter",
    "climate",
    "gun",
    "rights",
    "covid",
  ]);
  const [startDate, setStartDate] = useState(dayjs("2020-01-01"));
  const [endDate, setEndDate] = useState(dayjs("2021-12-31"));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("posts");
  const [keyword, setKeyword] = useState("");
  const [legislator, setLegislator] = useState(null);

  const [legislatorClicked, setLegislatorClicked] = useState([]);
  const [postData, setPostData] = useState([]);

  const handleFilterChange = (type, value) => {
    setFilters((prev) => ({ ...prev, [type]: value }));
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleSidebar = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    } else {
      setAboutOpen(false);
      setInfoOpen(false);
      setSidebarOpen(true);
    }
  };

  const toggleAbout = () => {
    if (aboutOpen) {
      setAboutOpen(false);
    } else {
      setSidebarOpen(false);
      setInfoOpen(false);
      setAboutOpen(true);
    }
  };

  const toggleInfo = () => {
    if (infoOpen) {
      setInfoOpen(false);
    } else {
      setSidebarOpen(false);
      setAboutOpen(false);
      setInfoOpen(true);
    }
  };

  useEffect(() => {
    const theme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  const handleDateChange = (newStart, newEnd) => {
    setStartDate(newStart);
    setEndDate(newEnd);
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar
        toggleSidebar={toggleSidebar}
        toggleAbout={toggleAbout}
        toggleInfo={toggleInfo}
      />
      <div className="flex flex-grow mt-16">
        <BrowserRouter>
          <div className="flex flex-grow relative">
            <div
              className={`fixed top-16 h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out z-30
                ${sidebarOpen ? "left-0" : "-left-64"}`}
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
                selectedMetric={selectedMetric}
                setSelectedMetric={setSelectedMetric}
                keyword={keyword}
                setKeyword={setKeyword}
                legislator={legislator}
                setLegislator={setLegislator}
              />
            </div>

            <SidebarAbout aboutOpen={aboutOpen} toggleAbout={toggleAbout} />
            <SidebarInfo infoOpen={infoOpen} toggleInfo={toggleInfo} />

            <div
              className={`flex-grow transition-all duration-300 ease-in-out
                ${sidebarOpen || aboutOpen || infoOpen ? "ml-64" : "ml-0"}`}
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
                    selectedTopics={activeTopics}
                    selectedMetric={selectedMetric}
                    keyword={keyword}
                    legislator={legislator}
                    setLegislator={setLegislator}
                    activeTopics={activeTopics}
                  />
                </div>
                <div className="col-span-3 bg-base-200 rounded-lg shadow-lg overflow-hidden">
                  <BipartiteFlow
                    activeTopics={activeTopics}
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={handleDateChange}
                    selectedMetric={selectedMetric}
                  />
                </div>
              </div>
            </div>
          </div>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
