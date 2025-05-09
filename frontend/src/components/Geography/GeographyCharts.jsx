import '../../App.css';
import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { FaSpinner } from 'react-icons/fa';
import ChoroplethMap from './ChoroplethMap';
import PropTypes from 'prop-types';

const stateAbbrevToName = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function GeographyCharts({ startDate, endDate, selectedTopics, selectedMetric }) {
  const [geojson, setGeojson] = useState(null);
  const [geoData, setGeoData] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNormalized, setIsNormalized] = useState(false);

  const legendWidth = 200;
  const legendHeight = 10;

  useEffect(() => {
    fetch('./us-states.json')
      .then(res => res.json())
      .then(data => {
        const states = topojson.feature(data, data.objects.states);
        setGeojson(states);
      })
      .catch(err => {
        console.error('Error loading GeoJSON:', err);
        setError("Failed to load geography data. Please try again.");
      });
  }, []);

  useEffect(() => {
    if (!startDate || !endDate || !selectedTopics || selectedTopics.length === 0) return;

    const formattedStart = startDate.format('YYYY-MM-DD');
    const formattedEnd = endDate.format('YYYY-MM-DD');
    const topicsParam = `topics=${selectedTopics.join(',')}`;
    const url = `/api/geo/activity/topics/?start_date=${formattedStart}&end_date=${formattedEnd}&${topicsParam}&metric=${selectedMetric}`;

    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(item => ({
          state: stateAbbrevToName[item.state] ?? item.state,
          republicanTotal: item.Republican || 0,
          democratTotal: item.Democratic || 0,
          total_engagement: item.total || 0,
          topic_breakdown: item.topic_breakdown || {},
        }));
        setGeoData(formatted);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching geo data:', err);
        setError("Failed to load geography data. Please try again.");
        setLoading(false);
      });
  }, [startDate, endDate, selectedTopics, selectedMetric]);

  useEffect(() => {
    if (!selectedState || !geoData.length) return;

    const updatedStateData = geoData.find(d => d.state === selectedState.name);
    if (updatedStateData) {
      setSelectedState({
        name: selectedState.name,
        topicBreakdown: updatedStateData.topic_breakdown,
      });
    }
  }, [geoData, selectedState?.name, selectedMetric]);

  const demMin = d3.min(geoData, d => d.democratTotal) || 0;
  const demMax = d3.max(geoData, d => d.democratTotal) || 0;
  const repMin = d3.min(geoData, d => d.republicanTotal) || 0;
  const repMax = d3.max(geoData, d => d.republicanTotal) || 0;

  const blueScale = d3.scaleLinear().domain([demMin, demMax]).range(['#add8e6', '#1e3a8a']);
  const redScale = d3.scaleLinear().domain([repMin, repMax]).range(['#f4cccc', '#cc0000']);

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

  const getMetricDisplayName = (metric) => {
    switch (metric) {
      case 'posts': return 'Posts';
      case 'legislators': return 'Legislators';
      case 'engagement': return 'Engagement';
      default: return 'Activity';
    }
  };

  const toggleNormalization = () => setIsNormalized(prev => !prev);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading geography data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <>
      <ChoroplethMap
        geojson={geojson}
        geoData={geoData}
        selectedMetric={selectedMetric}
        startDate={startDate}
        endDate={endDate}
        selectedTopics={selectedTopics}
        onStateSelected={setSelectedState}
        showLegend={false}
        blueScale={blueScale}
        redScale={redScale}
        isNormalized={isNormalized}
      />

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '30px', marginBottom: '20px' }}>
        <svg width={legendWidth * 3} height={legendHeight * 4} className="text-base-content">
          <g transform="translate(30, 0)">
            <text x={0} y={12} style={{ fontSize: '14px', fontWeight: 'bold' }} className="fill-current">Democrat</text>

            <g transform="translate(20, 20)">
              <text x={-25} y={10} style={{ fontSize: '10px' }} className="fill-current">{formatNumber(demMin)}</text>
              {blueScale.range().map((d, i) => (
                <rect
                  key={`blue-rect-${i}`}
                  x={i * ((legendWidth * 0.7) / blueScale.range().length)}
                  y={0}
                  width={(legendWidth * 0.7) / blueScale.range().length}
                  height={legendHeight}
                  style={{ fill: d }}
                />
              ))}
              <text x={(legendWidth * 0.7) + 5} y={10} style={{ fontSize: '10px' }} className="fill-current">{formatNumber(demMax)}</text>
            </g>

            <text x={legendWidth * 1.5} y={12} style={{ fontSize: '14px', fontWeight: 'bold' }} className="fill-current">Republican</text>
            
            <g transform={`translate(${legendWidth * 1.2 + 20}, 20)`}>
              <text x={-25} y={10} style={{ fontSize: '10px' }} className="fill-current">{formatNumber(repMin)}</text>
              {redScale.range().map((d, i) => (
                <rect
                  key={`red-rect-${i}`}
                  x={i * ((legendWidth * 0.7) / redScale.range().length)}
                  y={0}
                  width={(legendWidth * 0.7) / redScale.range().length}
                  height={legendHeight}
                  style={{ fill: d }}
                />
              ))}
              <text x={(legendWidth * 0.7) + 5} y={10} style={{ fontSize: '10px' }} className="fill-current">{formatNumber(repMax)}</text>
            </g>
          </g>
        </svg>
      </div>

      <div className="flex justify-center mb-4">
        <button onClick={toggleNormalization} className="btn btn-primary">
          {isNormalized ? 'Switch to Raw Data' : 'Switch to Normalized Data'}
        </button>
      </div>

      {selectedState && (
        <div className="mt-6 px-4">
          <h3 className="text-base-content text-xl font-bold mb-3">
            {selectedState.name} {getMetricDisplayName(selectedMetric)} Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
              <tr className="!bg-base-200">
                  <th className="text-base-content !bg-base-200 border-b-base-300">Topic</th>
                  <th className="!bg-base-200 text-blue-600 border-b-base-300">Democratic</th>
                  <th className="!bg-base-200 text-red-600 border-b-base-300">Republican</th>
                </tr>
              </thead>
              <tbody>
                  {Object.entries(selectedState.topicBreakdown).map(([topic, { Democratic, Republican }]) => (
                  <tr key={topic} className="hover">
                    <td className="font-medium">{topic}</td>
                    <td className="text-blue-600">{formatNumber(Democratic)}</td>
                    <td className="text-red-600">{formatNumber(Republican)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

GeographyCharts.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.array.isRequired,
  selectedMetric: PropTypes.string.isRequired,
};

export default GeographyCharts;

