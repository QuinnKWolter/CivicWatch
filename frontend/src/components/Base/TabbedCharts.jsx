import { useState, useEffect, useMemo } from "react";
import OverviewCharts from "../Overview/OverviewCharts";
import EngagementCharts from "../Engagement/EngagementCharts";
import GeographyCharts from "../Geography/GeographyCharts";
import LegislatorCharts from "../Legislators/LegislatorCharts";
import { RiDashboardLine } from "react-icons/ri";
import { BiTrendingUp } from "react-icons/bi";
import { MdOutlineAccountBox } from "react-icons/md";
import { FaUsers } from "react-icons/fa";
import { IoEarthOutline } from "react-icons/io5";
import dayjs from "dayjs";
import AccountabilityInterface from "../Accountability/AccountabilityInterface";

function TabbedCharts({
  legislatorClicked,
  postData,
  setLegislatorClicked,
  setPostData,
  startDate,
  endDate,
  selectedTopics,
  selectedMetric,
}) {
  const [value, setValue] = useState(0);
  const [hoveredTab, setHoveredTab] = useState(null);

  const [monthlyLeg, setMonthlyLeg] = useState([]);
  const [semanticData, setSemanticData] = useState([])

  // Memoize selectedTopics to prevent unnecessary re-renders
  const memoizedSelectedTopics = useMemo(
    () => selectedTopics,
    [selectedTopics]
  );

  const handleChange = (newValue) => {
    setValue(newValue);
  };

  const [legScatterData, setLegScatterData] = useState([]);
  const [loading, setLoading] = useState(false);

  // useEffect(() => {
  //   // Determine whether to use default data or fetch from the server
  //   fetch("http://localhost:8000/api/legislators/scatter/")
  //     .then((response) => response.json())
  //     .then((data) => {
  //       setLegScatterData(data);
  //     })
  //     .catch((error) =>
  //       console.error("Error fetching legislator data:", error)
  //     );
  // }, []);

  useEffect(() => {
    fetch("/api/legislators/scatter/")
      .then((response) => response.json())
      .then((data) => {
        const keys = [
          "abortion", "blacklivesmatter", "capitol", "civility_score_tw", "climate", "covid", "gun", "immigra",
          "interaction_score_tw", "overperforming_score_tw", "rights", "total_interactions_tw", "total_likes_tw",
          "total_misinfo_count_tw", "total_posts_tw_count", "total_retweets_tw"
        ];
  
        // Compute global min and max for each numeric metric
        const minMax = {};
        keys.forEach((key) => {
          const numericValues = data
            .map(d => parseFloat(d[key]))
            .filter(v => Number.isFinite(v));
  
          minMax[key] = {
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
          };
        });
  
        // Normalize the data
        const normalizedData = data.map(d => {
          let normalized = { ...d }; // keep all original fields
          keys.forEach(key => {
            const value = parseFloat(d[key]);
            const { min, max } = minMax[key];
            if (Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max)) {
              normalized[key] = (value - min) / (max - min || 1);
            }
            // Otherwise, leave the original value as-is
          });
          return normalized;
        });
        setLegScatterData(normalizedData);
      })
      .catch((error) =>
        console.error("Error fetching legislator data:", error)
      );
  }, []);
  

  useEffect(() => {
    if (startDate && endDate) {
      const url = "/api/legislators/scatter/?";
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
        end_date: endDate.format("YYYY-MM-DD"),
      };
      const queryParams = new URLSearchParams(params).toString();

      const query = `${url}${queryParams}`;
      setLoading(true);
      fetch(query)
        .then((response) => response.json())
        .then((data) => {
          console.log("rec'd monthly data", data);
          setMonthlyLeg(data);
        })
        .catch((error) =>
          console.error("Error filtering legislator data", error)
        )
        .finally(() => {
          setLoading(false);
        });
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (startDate && endDate) {
      const url = "http://localhost:8000/api/posts/post_semantic_similarity/?";
      const params = {
        start_date: startDate.format("YYYY-MM-DD"),
        end_date: endDate.format("YYYY-MM-DD"),
      };
      const queryParams = new URLSearchParams(params).toString();

      const query = `${url}${queryParams}`;
      setLoading(true);
      fetch(query)
        .then((response) => response.json())
        .then((data) => {
          setSemanticData(data);
          console.log("rec'd semantic data", data);
        })
        .catch((error) =>
          console.error("Error filtering legislator data", error)
        )
        .finally(() => {
          setLoading(false);
        });
    }
  }, [startDate, endDate]);

  const tabs = [
    { icon: <RiDashboardLine />, label: "Overview", value: 0 },
    { icon: <BiTrendingUp />, label: "Engagement", value: 1 },
    { icon: <MdOutlineAccountBox />, label: "Accountability", value: 2 },
    { icon: <FaUsers />, label: "Legislators", value: 3 },
    { icon: <IoEarthOutline />, label: "Geography", value: 4 },
  ];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="tab-container">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`tab-btn group py-2 px-4 rounded-t transition-all duration-300 ease-in-out
              ${
                value === tab.value
                  ? "bg-primary text-primary-content tab-active"
                  : "bg-base-300 text-base-content hover:bg-primary/20"
              }`}
            onClick={() => handleChange(tab.value)}
            onMouseEnter={() => setHoveredTab(tab.value)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">{tab.icon}</span>
              <span
                className={`tab-label ${
                  (value === tab.value && hoveredTab === null) ||
                  hoveredTab === tab.value
                    ? "opacity-100 max-w-[100px]"
                    : "opacity-0 max-w-0"
                }`}
              >
                {tab.label}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4 transition-opacity duration-500 ease-in-out">
        {value === 0 && (
          <OverviewCharts
            startDate={startDate}
            endDate={endDate}
            selectedTopics={memoizedSelectedTopics}
            keyword={keyword}
            legislator={legislator}
          />
        )}
        {value === 1 && (
          <EngagementCharts
            startDate={startDate}
            endDate={endDate}
            selectedTopics={memoizedSelectedTopics}
          />
        )}
        {value === 2 && (
          <AccountabilityInterface
            startDate={startDate}
            endDate={endDate}
            selectedTopics={memoizedSelectedTopics}
          />
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
            loading={loading}
            semanticData={semanticData}
          />
        )}
        {value === 4 && (
          <GeographyCharts
            startDate={startDate}
            endDate={endDate}
            selectedTopics={memoizedSelectedTopics}
            selectedMetric={selectedMetric}
          />
        )}
      </div>
    </div>
  );
}

export default TabbedCharts;
