import React, { useState, useEffect, useRef } from "react";
import { FaSpinner, FaThumbsUp, FaRetweet } from "react-icons/fa";
import Plotly from "plotly.js-dist";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale-subtle.css";
import { colorMap } from "./BipartiteFlow";

function EngagementCharts({ startDate, endDate, selectedTopics = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [splitEngagement, setSplitEngagement] = useState(false); // State for toggle
  const chartRef = useRef();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const defaultStartDate = '2020-01-01';
        const defaultEndDate = '2021-12-31';
        const defaultTopics = Object.keys(colorMap);

        let response;
        if (
          startDate.format('YYYY-MM-DD') === defaultStartDate &&
          endDate.format('YYYY-MM-DD') === defaultEndDate &&
          selectedTopics.length === defaultTopics.length &&
          selectedTopics.every(topic => defaultTopics.includes(topic))
        ) {
          // Fetch default data
          response = await fetch('http://localhost:8000/api/default_engagement_data/');
        } else {
          // Fetch regular data
          const topicsParam = selectedTopics.join(',');
          response = await fetch(`http://localhost:8000/api/engagement_metrics/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}`);
        }

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching engagement metrics:", err);
        setError("Failed to load engagement data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, selectedTopics]);

  useEffect(() => {
    if (!data) return;

    const { by_party } = data;

    const nodes = [
      { name: "Total Engagement" },
      ...Object.keys(by_party).map(party => ({ name: party })),
      ...Object.entries(by_party).flatMap(([party, partyData]) =>
        Object.keys(partyData.topics)
          .sort((a, b) => {
            const topicA = a.split(' (')[0];
            const topicB = b.split(' (')[0];
            return Object.keys(colorMap).indexOf(topicA) - Object.keys(colorMap).indexOf(topicB);
          })
          .flatMap(topic => {
            if (splitEngagement) {
              return [
                { name: `${topic} Likes` },
                { name: `${topic} Retweets` }
              ];
            }
            return { name: topic };
          })
      )
    ];

    const links = [];

    // Link Total Engagement to each party
    Object.entries(by_party).forEach(([party, partyData]) => {
      links.push({
        source: 0, // Total Engagement
        target: nodes.findIndex(node => node.name === party),
        value: partyData.total_engagement
      });

      // Link each party to its topics
      Object.keys(partyData.topics)
        .sort((a, b) => {
          const topicA = a.split(' (')[0];
          const topicB = b.split(' (')[0];
          return Object.keys(colorMap).indexOf(topicA) - Object.keys(colorMap).indexOf(topicB);
        })
        .forEach(topicWithParty => {
          const topicData = partyData.topics[topicWithParty];
          if (splitEngagement) {
            links.push({
              source: nodes.findIndex(node => node.name === party),
              target: nodes.findIndex(node => node.name === `${topicWithParty.split(' ')[0]} Likes`),
              value: topicData.likes
            });
            links.push({
              source: nodes.findIndex(node => node.name === party),
              target: nodes.findIndex(node => node.name === `${topicWithParty.split(' ')[0]} Retweets`),
              value: topicData.retweets
            });
          } else {
            links.push({
              source: nodes.findIndex(node => node.name === party),
              target: nodes.findIndex(node => node.name === topicWithParty),
              value: topicData.engagement
            });
          }
        });
    });

    const nodeColors = nodes.map(node => {
      if (node.name === "Total Engagement") return '#605dff'; // Purple for Total Engagement
      if (node.name === "Democratic") return '#005bb5'; // Blue for Democratic
      if (node.name === "Republican") return '#b30000'; // Red for Republican
      const [topic, party] = node.name.split(' (');
      const cleanParty = party?.replace(')', '');
      return colorMap[topic]?.[cleanParty] || '#000';
    });

    const plotData = {
      type: "sankey",
      orientation: "h",
      arrangement: "freeform",
      node: {
        pad: 20,
        thickness: 15,
        line: {
          color: "black",
          width: 0.5
        },
        label: nodes.map(node => node.name),
        color: nodeColors
      },
      link: {
        source: links.map(link => link.source),
        target: links.map(link => link.target),
        value: links.map(link => link.value),
        color: links.map(link => nodeColors[link.target]),
      }
    };

    const layout = {
      title: "Engagement Data",
      font: {
        size: 12,
        weight: "bold"
      },
      height: 1000,
      paper_bgcolor: "rgba(0,0,0,0)", // Transparent to allow CSS background
      plot_bgcolor: "rgba(0,0,0,0)", // Transparent to allow CSS background
    };

    const config = {
      displayModeBar: false // Hide the mode bar
    };

    Plotly.newPlot(chartRef.current, [plotData], layout, config);
  }, [data, splitEngagement]);

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading engagement metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <div>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const renderTopicList = (party, topics, totalEngagement) => (
    <div className="flex-1 overflow-y-auto max-h-64 p-2">
      <p className={`text-lg font-bold mb-2 ${party === 'Democratic' ? 'text-blue-500' : 'text-red-500'}`}>
        {party} Top Topics<br/><span className={'text-sm'}>Total Engagement: {formatNumber(totalEngagement)}</span>
      </p>
      <ul className="space-y-2">
        {Object.entries(topics)
          .sort(([, a], [, b]) => b.engagement - a.engagement)
          .map(([topic, metrics]) => {
            const topicName = topic.split(' ')[0];
            const partyKey = party === 'Democratic' ? 'D' : 'R';
            const color = colorMap[topicName]?.[partyKey] || '#000';
            return (
              <li key={topic} className="bg-base-100 p-2 rounded shadow-md">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                    <span className="font-semibold">{topicName}</span>
                  </div>
                  <div className="flex space-x-2">
                    <span className="flex items-center text-accent">
                      <FaThumbsUp className="mr-1" /> {formatNumber(metrics.likes)}
                    </span>
                    <span className="flex items-center text-info">
                      <FaRetweet className="mr-1" /> {formatNumber(metrics.retweets)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col space-y-4 p-2">
      <div className="flex items-center justify-center mb-4">
        <label className="label cursor-pointer">
          <span className="label-text mr-2">Split Engagement</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={splitEngagement}
            onChange={() => setSplitEngagement(!splitEngagement)}
          />
        </label>
      </div>

      <div className="flex space-x-4">
        {renderTopicList('Democratic', data.by_party.Democratic.topics, data.by_party.Democratic.total_engagement)}
        {renderTopicList('Republican', data.by_party.Republican.topics, data.by_party.Republican.total_engagement)}
      </div>

      <div ref={chartRef} className="bg-base-200"></div>
    </div>
  );
}

export default EngagementCharts; 