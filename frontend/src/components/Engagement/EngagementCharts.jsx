import React, { useState, useEffect, useRef } from "react";
import {
  FaSpinner,
  FaThumbsUp,
  FaRetweet,
  FaDemocrat,
  FaRepublican,
  FaChartBar,
  FaExchangeAlt
} from "react-icons/fa";
import Plotly from "plotly.js-dist";
import Tippy from '@tippyjs/react';
import { colorMap, topicIcons } from '../../utils/utils';
import SectionTitle from '../SectionTitle';

function TopicCard({ party, topics, totalEngagement, formatNumber }) {
  const isDem = party === 'Democratic';
  const iconProps = isDem
    ? { icon: <FaDemocrat className="text-blue-500 mr-1" />, label: 'Democrat Top Topics' }
    : { icon: <FaRepublican className="text-red-500 mr-1" />, label: 'Republican Top Topics' };

  return (
    <div className="card shadow-md flex-1">
      <div className="card-body p-2">
        <h3 className="card-title text-lg flex items-center">
          {iconProps.icon}
          {iconProps.label}
        </h3>
        <p className={`text-sm ${isDem ? 'text-blue-500' : 'text-red-500'}`}>
          Total Engagement: {formatNumber(totalEngagement)}
        </p>
        <ul className="space-y-2 mt-1 overflow-y-auto max-h-64 p-1">
          {Object.entries(topics)
            .sort(([, a], [, b]) => b.engagement - a.engagement)
            .map(([topic, metrics]) => {
              const topicName = topic.split(' ')[0];
              const color = colorMap[topicName]?.[isDem ? 'D' : 'R'] || '#000';
              const IconComponent = topicIcons[topicName] || FaSpinner;
              return (
                <li key={topic} className="bg-base-100 p-2 rounded shadow-sm">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                      <Tippy content={topicName}>
                        <span className="font-semibold">
                          <IconComponent className="text-xl" />
                        </span>
                      </Tippy>
                    </div>
                    <div className="flex space-x-2">
                      <span className="flex items-center text-primary">
                        <FaThumbsUp className="mr-1" /> <span className="text-base-content">{formatNumber(metrics.likes)}</span>
                      </span>
                      <span className="flex items-center text-primary">
                        <FaRetweet className="mr-1 text-lg" /> <span className="text-base-content">{formatNumber(metrics.retweets)}</span>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}

function EngagementCharts({ startDate, endDate, selectedTopics = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
          response = await fetch('/api/default_engagement_data/');
        } else {
          const topicsParam = selectedTopics.join(',');
          response = await fetch(`/api/engagement_metrics/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}`);
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
          .map(topic => ({ name: topic }))
      )
    ];

    const links = [];
    Object.entries(by_party).forEach(([party, partyData]) => {
      links.push({
        source: 0,
        target: nodes.findIndex(node => node.name === party),
        value: partyData.total_engagement
      });
      Object.keys(partyData.topics)
        .sort((a, b) => {
          const topicA = a.split(' (')[0];
          const topicB = b.split(' (')[0];
          return Object.keys(colorMap).indexOf(topicA) - Object.keys(colorMap).indexOf(topicB);
        })
        .forEach(topicWithParty => {
          const topicData = partyData.topics[topicWithParty];
          links.push({
            source: nodes.findIndex(node => node.name === party),
            target: nodes.findIndex(node => node.name === topicWithParty),
            value: topicData.engagement
          });
        });
    });

    const nodeColors = nodes.map(node => {
      if (node.name === "Total Engagement") return '#605dff';
      if (node.name === "Democratic") return '#005bb5';
      if (node.name === "Republican") return '#b30000';
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
        line: { color: "black", width: 0.5 },
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
      font: { size: 12, weight: "bold" },
      height: 1000,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 10, r: 10, b: 10, t: 10, pad: 4 }
    };

    const config = { displayModeBar: false };
    Plotly.newPlot(chartRef.current, [plotData], layout, config);
  }, [data]);

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

  if (!data) return null;

  return (
    <div className="flex flex-col space-y-4 p-2">
      <SectionTitle icon={<FaChartBar />} text="Top Topics by Engagement" helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>This section shows the most engaging topics for each party.</li>
            <li>Topics are ranked by total engagement (likes + retweets).</li>
            <li>Color coding indicates party affiliation (blue for Democrats, red for Republicans).</li>
          </ul>
        </div>
      } />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <TopicCard party='Democratic' topics={data.by_party.Democratic.topics} totalEngagement={data.by_party.Democratic.total_engagement} formatNumber={formatNumber} />
        <TopicCard party='Republican' topics={data.by_party.Republican.topics} totalEngagement={data.by_party.Republican.total_engagement} formatNumber={formatNumber} />
      </div>

      <SectionTitle icon={<FaExchangeAlt />} text="Engagement Flow" helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>This Sankey diagram visualizes the flow of engagement across topics and parties.</li>
            <li>The width of each flow represents the volume of engagement.</li>
            <li>Follow the connections to see how engagement is distributed between topics.</li>
            <li>Node colors indicate party affiliation and topic categories.</li>
          </ul>
        </div>
      } />
      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
          <div ref={chartRef}></div>
        </div>
      </div>
    </div>
  );
}

export default EngagementCharts;