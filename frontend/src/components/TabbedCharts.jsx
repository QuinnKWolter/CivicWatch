import React, { useState, useEffect } from "react";
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

function TabbedCharts({ legislatorClicked, postData, setLegislatorClicked, setPostData, startDate, endDate }) {
  const [value, setValue] = useState(0);

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
      console.log("Fetching data from server");
      fetch("http://localhost:8000/api/legislators/scatter/")
        .then((response) => response.json())
        .then((data) => {
          console.log("Legislator Data: ", data);
          setLegScatterData(data);
        })
        .catch((error) =>
          console.error("Error fetching legislator data:", error)
        );
  }, []);
  
  useEffect(() => {
      console.log("filtering data");
      if (startDate && endDate) {
        const url = "http://localhost:8000/api/legislators/scatter/?";
        const params = {
          startDate: startDate.format("DD-MM-YYYY"),
          endDate: endDate.format("DD-MM-YYYY"),
        };
        const queryParams = new URLSearchParams(params).toString();
  
        const query = `${url}${queryParams}`;
        console.log("query", query);
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
        console.log("done filtering");
        console.log("filtered data", filteredData);
      }
    }, [startDate, endDate]);

  // created_at	topic	party	like_count	retweet_count	total_posts	total_interactions

  const posts = [
    { post_id: 1, interaction_score: 0.45, post_accountability_score: 0.62 }, // accountability score some weighted metric?
    { post_id: 2, interaction_score: 0.32, post_accountability_score: 0.92 },
    { post_id: 3, interaction_score: 0.45, post_accountability_score: 0.85 },
    { post_id: 4, interaction_score: 0.29, post_accountability_score: 0.78 },
    { post_id: 5, interaction_score: 0.63, post_accountability_score: 0.89 },
    { post_id: 6, interaction_score: 0.51, post_accountability_score: 0.72 },
    { post_id: 7, interaction_score: 0.38, post_accountability_score: 0.95 },
    { post_id: 8, interaction_score: 0.66, post_accountability_score: 0.88 },
    { post_id: 9, interaction_score: 0.47, post_accountability_score: 0.77 },
    { post_id: 10, interaction_score: 0.34, post_accountability_score: 0.81 },
    { post_id: 11, interaction_score: 0.58, post_accountability_score: 0.9 },
    { post_id: 12, interaction_score: 0.4, post_accountability_score: 0.83 },
    { post_id: 13, interaction_score: 0.49, post_accountability_score: 0.76 },
    { post_id: 14, interaction_score: 0.68, post_accountability_score: 0.93 },
    { post_id: 15, interaction_score: 0.55, post_accountability_score: 0.87 },
    { post_id: 16, interaction_score: 0.37, post_accountability_score: 0.84 },
    { post_id: 17, interaction_score: 0.61, post_accountability_score: 0.8 },
    { post_id: 18, interaction_score: 0.46, post_accountability_score: 0.79 },
    { post_id: 19, interaction_score: 0.33, post_accountability_score: 0.86 },
    { post_id: 20, interaction_score: 0.59, post_accountability_score: 0.91 },
    { post_id: 21, interaction_score: 0.42, post_accountability_score: 0.82 },
    { post_id: 22, interaction_score: 0.36, post_accountability_score: 0.75 },
    { post_id: 23, interaction_score: 0.62, post_accountability_score: 0.88 },
    { post_id: 24, interaction_score: 0.44, post_accountability_score: 0.94 },
    { post_id: 25, interaction_score: 0.5, post_accountability_score: 0.7 },
    { post_id: 26, interaction_score: 0.64, post_accountability_score: 0.89 },
    { post_id: 27, interaction_score: 0.41, post_accountability_score: 0.85 },
    { post_id: 28, interaction_score: 0.56, post_accountability_score: 0.92 },
    { post_id: 29, interaction_score: 0.35, post_accountability_score: 0.73 },
    { post_id: 30, interaction_score: 0.48, post_accountability_score: 0.78 },
    { post_id: 31, interaction_score: 0.6, post_accountability_score: 0.96 },
    { post_id: 32, interaction_score: 0.43, post_accountability_score: 0.74 },
  ];

  const metrics = ["overperforming_score", "civility_score", "count_misinfo"];

  const tabs = [
    { icon: <RiDashboardLine />, label: "Overview", value: 0 },
    { icon: <BiTrendingUp />, label: "Engagement", value: 1 },
    { icon: <MdOutlineAccountBox />, label: "Accountability", value: 2 },
    { icon: <FaUsers />, label: "Legislators", value: 3 },
    { icon: <IoEarthOutline />, label: "Geography", value: 4 },
  ];

  return (
    <div>
      <div className="flex justify-center space-x-2 border-b border-base-300">
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
        {value === 0 && <OverviewCharts />}
        {value === 1 && (
          <div>
            <h6 className="text-lg">Engagement Content</h6>
            {/* Add Engagement content here */}
          </div>
        )}
        {value === 2 && (
          <div>
            <h6 className="text-lg">Accountability Content</h6>
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
          />
        )}
        {value === 4 && (
          <div>
            <h6 className="text-lg">Geography Content</h6>
            {/* Add Geography content here */}
            <ChoroplethMap startDate={startDate} endDate={endDate} activeTopics={activeTopics}/>
          </div>
        )}
      </div>
    </div>
  );
}

export default TabbedCharts;
