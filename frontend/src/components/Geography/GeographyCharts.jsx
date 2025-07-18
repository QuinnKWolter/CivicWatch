import '../../App.css';
import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import { FaSpinner, FaMapMarkedAlt, FaTable } from 'react-icons/fa';
import ChoroplethMap from './ChoroplethMap';
import PropTypes from 'prop-types';
import SectionTitle from '../SectionTitle';
import { ChordDiagram } from '../Interactions/ChordDiagram';
import { BiOutline } from 'react-icons/bi';
import useMeasure from 'react-use-measure';

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

function GeographyCharts({ startDate, endDate, selectedTopics, selectedMetric, geoData, setGeoData, geojson, legislator, setLegislator }) {
  const [selectedState, setSelectedState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNormalized, setIsNormalized] = useState(false);
  const [connections, setConnections] = useState([]);
  const [ref, bounds] = useMeasure();

  const legendWidth = 200;
  const legendHeight = 10;

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
  }, [startDate, endDate, selectedTopics, selectedMetric, setGeoData]);

  useEffect(() => {
    if (!selectedState || !geoData.length) return;

    const updatedStateData = geoData.find(d => d.state === selectedState.name);
    if (updatedStateData) {
      setSelectedState({
        name: selectedState.name,
        topicBreakdown: updatedStateData.topic_breakdown,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData, selectedState?.name, selectedMetric]);

  useEffect(() => {
    if (!legislator?.legislator_id) {
      setConnections([]);
      return;
    }

    const params = {
      start_date: startDate.format("YYYY-MM-DD"),
      end_date: endDate.format("YYYY-MM-DD"),
      legislator: legislator.legislator_id,
    };

    const queryParams = new URLSearchParams(params).toString();
    const url = `/api/chord/chord_interactions/?${queryParams}`;

    function includesPair(arr, pair) {
      return arr.some((item) => item[0] === pair[0] && item[1] === pair[1]);
    }

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const filteredData = data.filter(
          (d) => d.count > 0 && d.source_name !== d.target_name
        );

        if (filteredData.length === 0) {
          setConnections([]);
          return;
        }

        const filteredConnections = [];

        filteredData.forEach((d) => {
          let toAdd = [
            stateAbbrevToName[d.source_state],
            stateAbbrevToName[d.target_state],
          ];

          if (
            !includesPair(filteredConnections, toAdd) &&
            d.source_state !== d.target_state
          ) {
            filteredConnections.push(toAdd);
          }
        });

        setConnections(filteredConnections);
      })
      .catch((error) => {
        console.error("Error fetching interaction data:", error);
        setConnections([]);
      });
  }, [legislator, startDate, endDate]);

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
    <div className="flex flex-col space-y-4 p-2">
      <SectionTitle icon={<FaMapMarkedAlt />} text={`Geographic ${getMetricDisplayName(selectedMetric)} Distribution`} helpContent={
        <div className="text-left">
          <ul className="list-disc list-inside space-y-1">
            <li>This choropleth map shows the distribution of {getMetricDisplayName(selectedMetric).toLowerCase()} across states.</li>
            <li>Color intensity indicates activity level, with darker shades showing higher values.</li>
            <li>Toggle between raw totals and normalized data using the button below the map.</li>
            <li>Click on a state to view a table of detailed topic breakdowns.</li>
          </ul>
        </div>
      } />
      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
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
            connections={connections}
          />
          <div className="flex justify-center mt-2">
            <svg width={legendWidth * 3} height={legendHeight * 4} className="text-base-content">
              <g transform="translate(30, 0)">
                <text x={0} y={12} className="text-sm font-bold fill-current">Democrat</text>
                <g transform="translate(20, 20)">
                  <text x={-25} y={10} className="text-xs fill-current">{formatNumber(demMin)}</text>
                  {blueScale.range().map((d, i) => (
                    <rect key={`blue-rect-${i}`} x={i * ((legendWidth * 0.7) / blueScale.range().length)} y={0} width={(legendWidth * 0.7) / blueScale.range().length} height={legendHeight} style={{ fill: d }} />
                  ))}
                  <text x={(legendWidth * 0.7) + 5} y={10} className="text-xs fill-current">{formatNumber(demMax)}</text>
                </g>
                <text x={legendWidth * 1.5} y={12} className="text-sm font-bold fill-current">Republican</text>
                <g transform={`translate(${legendWidth * 1.2 + 20}, 20)`}>
                  <text x={-25} y={10} className="text-xs fill-current">{formatNumber(repMin)}</text>
                  {redScale.range().map((d, i) => (
                    <rect key={`red-rect-${i}`} x={i * ((legendWidth * 0.7) / redScale.range().length)} y={0} width={(legendWidth * 0.7) / redScale.range().length} height={legendHeight} style={{ fill: d }} />
                  ))}
                  <text x={(legendWidth * 0.7) + 5} y={10} className="text-xs fill-current">{formatNumber(repMax)}</text>
                </g>
              </g>
            </svg>
          </div>
          <div className="card-actions justify-center mt-2">
            <button onClick={toggleNormalization} className="btn btn-primary btn-sm">
              {isNormalized ? 'Show Raw Totals' : 'Show Normalized Data'}
            </button>
          </div>
        </div>
        <div className="card-body p-2">
          <div className="h-96" ref={ref}>
            <ChordDiagram
              width={bounds.width}
              height={bounds.height}
              startDate={startDate}
              endDate={endDate}
              legislator={legislator}
              geojson={geojson}
              setLegislator={setLegislator}
            />
          </div>
          </div>
        <div className="card-body p-2" >
          <div className='h-96'>
            {legislator?.legislator_id && (
              <div className="text-center mb-4">
                <div className="badge badge-primary mb-2">Showing Interactions</div>
                <h3 className="text-lg font-semibold">
                  Legislator: {legislator.name || legislator.legislator_id}
                </h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedState && (
        <>
          <SectionTitle icon={<FaTable />} text={`${selectedState.name}: ${getMetricDisplayName(selectedMetric)} Breakdown`} helpContent={
            <div className="text-left">
              <ul className="list-disc list-inside space-y-1">
                <li>This table shows the detailed breakdown of {getMetricDisplayName(selectedMetric).toLowerCase()} by topic for {selectedState.name}.</li>
                <li>Values are separated by party (Democratic and Republican).</li>
                <li>Topics are sorted by total {getMetricDisplayName(selectedMetric).toLowerCase()} count within the state.</li>
                <li>Use this view to compare topic {getMetricDisplayName(selectedMetric).toLowerCase()} patterns between parties.</li>
              </ul>
            </div>
          } />
          <div className="card shadow-md bg-base-300">
            <div className="card-body p-2">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr className="!bg-base-200">
                      <th className="!bg-base-200 border-b-base-300">Topic</th>
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
          </div>
        </>
      )}
    </div>
  );
}

GeographyCharts.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.array.isRequired,
  selectedMetric: PropTypes.string.isRequired,
  geoData: PropTypes.array.isRequired,
  setGeoData: PropTypes.func.isRequired,
  geojson: PropTypes.object,
  legislator: PropTypes.shape({
    legislator_id: PropTypes.string,
    name: PropTypes.string
  })
};

export default GeographyCharts;