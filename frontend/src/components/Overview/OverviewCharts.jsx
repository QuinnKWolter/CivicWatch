import React, { useState, useEffect } from "react";
import { FaChartBar, FaChartLine, FaSpinner, FaNewspaper, FaThumbsUp, FaRetweet, FaExchangeAlt, FaDemocrat, FaRepublican, FaUserFriends, FaExclamationTriangle, FaHandshakeSlash, FaMapMarkerAlt } from "react-icons/fa";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import TrendLineChart from './TrendLineChart';
import { colorMap, formatNumber } from '../../utils/utils';

function OverviewCharts({ startDate, endDate, selectedTopics = [], keyword, legislator }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          selectedTopics.every(topic => defaultTopics.includes(topic)) &&
          keyword === '' &&
          legislator === null
        ) {
          // Fetch default data
          console.log("Fetching default data");
          response = await fetch('/api/default_overview_data/');
        } else {
          // Fetch regular data
          console.log("keyword", keyword)
          console.log("legislator", legislator)
          const topicsParam = selectedTopics.join(',');
          const keywordParam = keyword ? `&keyword=${encodeURIComponent(keyword)}` : '';
          const legislatorParam = legislator ? `&legislator=${encodeURIComponent(legislator.name)}` : '';
          response = await fetch(`/api/overview_metrics/?start_date=${startDate.format('YYYY-MM-DD')}&end_date=${endDate.format('YYYY-MM-DD')}&topics=${topicsParam}${keywordParam}${legislatorParam}`);
        }

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        // console.log("Overview data:", data);
        setData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching overview metrics:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, selectedTopics, keyword, legislator]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summaryMetrics } = data;
  
  // Determine if the date range is greater than 365 days
  const isWeekly = endDate.diff(startDate, 'days') > 365;

  return (
    <div className="flex flex-col space-y-4 p-2">
      {/* Summary Metrics Cards */}
      <h2 className="text-lg flex items-center">
        <FaChartBar className="mr-1" />
        Summary Metrics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(summaryMetrics).map(([party, metrics]) => (
          <div key={party} className="card shadow-md">
            <div className="card-body p-2">
              <h2 className="card-title text-lg flex items-center">
                {party === 'Democratic' ? (
                  <FaDemocrat className="text-blue-500 mr-1" />
                ) : (
                  <FaRepublican className="text-red-500 mr-1" />
                )}
                {party === 'Democratic' ? 'Democrats' : 'Republicans'}
              </h2>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Tippy content="Total number of posts made by legislators in this party" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-primary text-base font-bold">
                      <FaNewspaper className="text-xl text-primary" />
                      {formatNumber(metrics.totalPosts)}
                    </span>
                    <span className="ml-auto text-sm text-primary font-bold overflow-hidden whitespace-nowrap">
                      Posts
                    </span>
                  </div>
                </Tippy>
                
                <Tippy content="Number of legislators" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-primary text-base font-bold">
                      <FaUserFriends className="text-xl text-primary" />
                      {metrics.numberLegislators}
                    </span>
                    <span className="ml-auto text-sm text-primary font-bold overflow-hidden whitespace-nowrap">
                      Legislators
                    </span>
                  </div>
                </Tippy>
                
                <Tippy content="Total likes for all posts" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center text-center">
                    <span className="stat-value text-primary text-base font-bold">
                      <FaThumbsUp className="text-xl text-primary" />
                      {formatNumber(metrics.totalLikes)}
                    </span>
                    <span className="ml-auto text-sm text-primary font-bold overflow-hidden whitespace-nowrap">
                      Likes
                    </span>
                  </div>
                </Tippy>

                <Tippy content="Total retweets for all posts" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-primary text-base font-bold">
                      <FaRetweet className="text-xl text-primary" />
                      {formatNumber(metrics.totalRetweets)}
                    </span>
                    <span className="ml-auto text-sm text-primary font-bold overflow-hidden whitespace-nowrap">
                      Retweets
                    </span>
                  </div>
                </Tippy>

                <Tippy content="Most active state" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-primary text-base font-bold">
                      <FaMapMarkerAlt className="text-xl text-primary" />
                      {metrics.mostActiveState}
                    </span>
                    <span className="ml-auto text-sm text-primary font-bold overflow-hidden whitespace-nowrap">
                      Top State
                    </span>
                  </div>
                </Tippy>

                <Tippy content="Average interaction score" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-primary text-base font-bold">
                      <FaExchangeAlt className="text-xl text-primary" />
                      {metrics.avgInteractionScore?.toFixed(2)}
                    </span>
                    <span className="ml-auto text-sm text-primary font-bold overflow-hidden whitespace-nowrap">
                      Top Topic
                    </span>
                  </div>
                </Tippy>

                <Tippy content="Number of uncivil posts" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-error text-base font-bold">
                      <FaHandshakeSlash className="text-xl text-error" />
                      {metrics.numUncivilPosts}
                    </span>
                    <span className="ml-auto text-sm text-error font-bold overflow-hidden whitespace-nowrap">
                      Uncivil Posts
                    </span>
                  </div>
                </Tippy>

                <Tippy content="Number of misinformation posts" animation="scale-subtle" arrow={true}>
                  <div className="stat bg-base-100 rounded-box p-2 flex items-center">
                    <span className="stat-value text-error text-base font-bold">
                      <FaExclamationTriangle className="text-xl text-error" />
                      {metrics.numMisinfoPosts}
                    </span>
                    <span className="ml-auto text-sm text-error font-bold overflow-hidden whitespace-nowrap">
                      Misinfo Posts
                    </span>
                  </div>
                </Tippy>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Line Chart Section */}
      <h2 className="text-lg flex items-center">
        <FaChartLine className="mr-1" />
        Engagement Trends Over Time {isWeekly ? "(Weekly)" : "(Daily)"}
      </h2>
      <div className="card shadow-md">
        <div className="card-body p-2">
          <div className="h-80">
            <TrendLineChart startDate={startDate} endDate={endDate} selectedTopics={selectedTopics} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewCharts; 