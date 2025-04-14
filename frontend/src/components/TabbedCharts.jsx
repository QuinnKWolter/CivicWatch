import React, { useState, useEffect, useMemo } from "react";
import { Radar } from "./Radar";
import { LineChart } from "./PostLinechart";
import LegislatorCharts from "./LegislatorCharts";
import OverviewCharts from "./OverviewCharts";
import { RiDashboardLine } from "react-icons/ri";
import { BiTrendingUp } from "react-icons/bi";
import { MdOutlineAccountBox } from "react-icons/md";
import { FaUsers } from "react-icons/fa";
import { IoEarthOutline } from "react-icons/io5";
import dayjs from "dayjs"
import EngagementCharts from "./EngagementCharts";
import ChoroplethMap from './ChoroplethMap';

function TabbedCharts({ legislatorClicked, postData, setLegislatorClicked, setPostData, startDate, endDate, selectedTopics, selectedMetric }) {
  const [value, setValue] = useState(0);

  const [monthlyLeg, setMonthlyLeg] = useState([]);

  // Memoize selectedTopics to prevent unnecessary re-renders
  const memoizedSelectedTopics = useMemo(() => selectedTopics, [selectedTopics]);

  const handleChange = (newValue) => {
    setValue(newValue);
  };

  const [legScatterData, setLegScatterData] = useState([]);

  const axisConfig = [
    { name: "total_misinfo_count_tw", max: 2735 },
    { name: "total_interactions_tw", max: 93472549 },
    { name: "overperforming_score_tw", max: 1.296785754 },
  ];

  const axisConfigTopics = [
    { name: "capitol", max: 244 },
    { name: "climate", max: 418 },
    { name: "covid", max: 2515 },
    { name: "gun", max: 427 },
    { name: "immigra", max: 384 },
    { name: "rights", max: 327 },
    
  ];

  const legislators = [
    {
      name: "John Smith",
      overperforming_score: 20,
      civility_score: 85,
      count_misinfo: 40,
    },

    // Add more legislators as needed
  ];

  useEffect(() => {
      // Determine whether to use default data or fetch from the server
      fetch("http://localhost:8000/api/legislators/scatter/")
        .then((response) => response.json())
        .then((data) => {
          setLegScatterData(data);
        })
        .catch((error) =>
          console.error("Error fetching legislator data:", error)
        );
  }, []);
  
  useEffect(() => {
      if (startDate && endDate) {
        const url = "http://localhost:8000/api/legislators/scatter/?";
        const params = {
          startDate: startDate.format("DD-MM-YYYY"),
          endDate: endDate.format("DD-MM-YYYY"),
        };
        const queryParams = new URLSearchParams(params).toString();
  
        const query = `${url}${queryParams}`;
        fetch(query)
          .then((response) => response.json())
          .then((data) => {
            setLegScatterData(data);
          })
          .catch((error) =>
            console.error("Error filtering legislator data: ", error)
          );
        const filteredData = legScatterData.filter((item) => {
          const itemDate = dayjs(item.date);
          return (
            itemDate.isSameOrAfter(startDate) && itemDate.isSameOrBefore(endDate)
          );
        });
        setLegScatterData(filteredData);
      }
  }, [startDate, endDate]);
  
  useEffect(() => {
    if (startDate && endDate) {
      const url = "http://localhost:8000/api/legislators/legislator_posts_by_month_top_50/?"
      const params = {
        start_date: startDate.format("YYYY-MM-DD"),
        end_date: endDate.format("YYYY-MM-DD")
      }
      const queryParams = new URLSearchParams(params).toString();

      const query = `${url}${queryParams}`;
      fetch(query)
        .then((response) => response.json())
        .then((data) => {
          setMonthlyLeg(data);
        })
        .catch((error) =>
          console.error("Error filtering legislator data", error));
      
    }
    
  },[startDate, endDate])

  const tabs = [
    { icon: <RiDashboardLine />, label: "Overview", value: 0 },
    { icon: <BiTrendingUp />, label: "Engagement", value: 1 },
    { icon: <MdOutlineAccountBox />, label: "Accountability", value: 2 },
    { icon: <FaUsers />, label: "Legislators", value: 3 },
    { icon: <IoEarthOutline />, label: "Geography", value: 4 },
  ];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="flex justify-center space-x-2 border-b border-base-300 bg-base-100">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`tab-btn group py-2 px-4 rounded-t transition-all duration-300 ease-in-out
              ${value === tab.value ? 'bg-primary text-primary-content tab-active' : 'bg-base-300 text-base-content hover:bg-primary/20'}`}
            onClick={() => handleChange(tab.value)}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">{tab.icon}</span>
              <span className={`whitespace-nowrap transition-all duration-300 ${
                value === tab.value 
                  ? 'opacity-100 max-w-[100px]' 
                  : 'opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[100px]'
              }`}>
                {tab.label}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4 transition-opacity duration-500 ease-in-out">
        {value === 0 && <OverviewCharts startDate={startDate} endDate={endDate} selectedTopics={memoizedSelectedTopics} />}
        {value === 1 && <EngagementCharts startDate={startDate} endDate={endDate} selectedTopics={memoizedSelectedTopics} />}
        {value === 2 && (
          <div>
            <LineChart data={postData} width={300} height={300} />
          </div>
        )}
        {value === 3 && (
          <LegislatorCharts
            legislatorClicked={legislatorClicked}
            setLegislatorClicked={setLegislatorClicked}
            postData={postData}
            setPostData={setPostData}
            startDate={startDate}
            endDate={endDate}
            legScatterData={legScatterData}
            monthlyLeg={monthlyLeg}
          />
        )}
        {value === 4 && (
          <div>
            <h6 className="text-lg">Geography Content</h6>
            {/* Add Geography content here */}
            <ChoroplethMap 
              startDate={startDate} 
              endDate={endDate} 
              activeTopics={selectedTopics}
              selectedMetric={selectedMetric}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default TabbedCharts;
