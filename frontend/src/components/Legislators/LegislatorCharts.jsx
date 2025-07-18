import React, { useEffect, useMemo, useRef, useState } from "react";
import { Radar } from "./Radar";
import { RidgeLinePlot } from "./RidgeLine";
import { LegislatorHeatMap } from "./LegislatorHeatMap";
import {
  FaSpinner,
  FaTh,
  FaChartArea,
  FaSatelliteDish,
  FaClipboardList,
  FaChartLine,
  FaDemocrat,
  FaRepublican,
  FaUndo, 
} from "react-icons/fa";
import useMeasure from "react-use-measure";
import SectionTitle from "../SectionTitle";

function LegislatorCharts({
  legislatorClicked,
  setLegislatorClicked,
  postData,
  setPostData,
  startDate,
  endDate,
  legScatterData,
  monthlyLeg,
  loading,
  semanticData,
  legislator,
  geojson,
  setLegislator,
  activeTopics,
}) {
  const [ref, bounds] = useMeasure();
  const [match, setMatch] = useState(true);

  const axisConfig = useMemo(() => {
    if (!legScatterData || legScatterData.length === 0) return [];
    return [
      {
        name: "total_misinfo_count_tw",
        display_name: "Low Credibility",
        max: Math.max(
          ...legScatterData.map((d) => d.total_misinfo_count_tw).filter(Number.isFinite)
        ),
      },
      {
        name: "total_interactions_tw",
        display_name: "Interactions",
        max: Math.max(
          ...legScatterData.map((d) => d.total_interactions_tw).filter(Number.isFinite)
        ),
      },
      {
        name: "overperforming_score_tw",
        display_name: "Virality",
        max: Math.max(
          ...legScatterData.map((d) => d.overperforming_score_tw).filter(Number.isFinite)
        ),
      },
    ];
  }, [legScatterData]);

  const axisConfigTopics = useMemo(() => {
    if (!legScatterData || legScatterData.length === 0) return [];
    let topics = [
      {
        name: "capitol",
        display_name: "Capitol",
        max: Math.max(...legScatterData.map((d) => d.capitol).filter(Number.isFinite)),
      },
      {
        name: "climate",
        display_name: "Climate",
        max: Math.max(...legScatterData.map((d) => d.climate).filter(Number.isFinite)),
      },
      {
        name: "covid",
        display_name: "Covid",
        max: Math.max(...legScatterData.map((d) => d.covid).filter(Number.isFinite)),
      },
      {
        name: "gun",
        display_name: "Gun",
        max: Math.max(...legScatterData.map((d) => d.gun).filter(Number.isFinite)),
      },
      {
        name: "immigra",
        display_name: "Immigra",
        max: Math.max(...legScatterData.map((d) => d.immigra).filter(Number.isFinite)),
      },
      {
        name: "rights",
        display_name: "Rights",
        max: Math.max(...legScatterData.map((d) => d.rights).filter(Number.isFinite)),
      },
      {
        name: "abortion",
        display_name: "Abortion",
        max: Math.max(...legScatterData.map((d) => d.abortion).filter(Number.isFinite)),
      },
      {
        name: "blacklivesmatter",
        display_name: "BLM",
        max: Math.max(...legScatterData.map((d) => d.blacklivesmatter).filter(Number.isFinite)),
      },
    ];
    return topics.filter((d) => activeTopics.includes(d.name.toLowerCase()));
  }, [activeTopics, legScatterData]);

  const [cVal, setCVal] = useState(0);
  const [dVal, setDVal] = useState(0);
  const [demData, setDemData] = useState([]);
  const [repubData, setRepubData] = useState([]);

  useEffect(() => {
    if (!loading && monthlyLeg) {
      setDemData(monthlyLeg.legislators.filter((d) => d.party === "D"));
      setRepubData(monthlyLeg.legislators.filter((d) => d.party === "R"));
    }
  }, [monthlyLeg, loading]);

  useEffect(() => {
    if (legislator && demData.length && repubData.length) {
      const matchInData =
        demData.some((d) => d.name === legislator.name) ||
        repubData.some((d) => d.name === legislator.name);
      setMatch(matchInData);
    } else {
      setMatch(true); // default to true when no legislator selected
    }
  }, [demData, legislator, repubData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading legislator data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-2 h-full overflow-y-auto">
      <SectionTitle
        icon={<FaTh />}
        text="Legislator Activity Heatmap"
        helpContent={
          <div className="text-left">
            <ul className="list-disc list-inside space-y-1">
              <li>This heatmap visualizes legislator activity patterns over time.</li>
              <li>
                Color intensity indicates activity level, with darker shades showing
                higher engagement.
              </li>
              <li>Toggle between Democratic and Republican views using the tabs above.</li>
            </ul>
          </div>
        }
      />

      {/* Clear button shown if legislator is selected */}
      {legislator && (
        <div className="mb-2">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              setLegislator(null);
              setLegislatorClicked(null);
            }}
          >
            <FaUndo className="mr-1" />
            Clear Selection (Back to Heatmap)
          </button>
        </div>
      )}

      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
          <div className="tabs tabs-boxed">
            <a className={`tab gap-2 ${dVal === 0 ? "tab-active" : ""}`} onClick={() => setDVal(0)}>
              <FaDemocrat /> Democrats
            </a>
            <a className={`tab gap-2 ${dVal === 1 ? "tab-active" : ""}`} onClick={() => setDVal(1)}>
              <FaRepublican /> Republicans
            </a>
          </div>
          <div ref={ref} className="mt-2">
            {!legislator && match && bounds.width > 0 && (
              <div className="relative overflow-y-auto min-h-[400px]">
                {dVal === 0 && (
                  <LegislatorHeatMap
                    width={bounds.width}
                    height={bounds.width * 1.75}
                    startDate={startDate}
                    endDate={endDate}
                    data={demData}
                    legScatterData={legScatterData}
                    setLegislatorClicked={setLegislatorClicked}
                    party={1}
                    legislatorClicked={legislatorClicked}
                    legislator={legislator}
                    setLegislator={setLegislator}
                    match={match}
                  />
                )}
                {dVal === 1 && (
                  <LegislatorHeatMap
                    width={bounds.width}
                    height={bounds.width * 1.75}
                    startDate={startDate}
                    endDate={endDate}
                    data={repubData}
                    legScatterData={legScatterData}
                    setLegislatorClicked={setLegislatorClicked}
                    party={2}
                    legislatorClicked={legislatorClicked}
                    legislator={legislator}
                    setLegislator={setLegislator}
                    match={match}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Only show charts if legislator selected */}
      {legislator && (
        <>
          <SectionTitle
            icon={<FaChartArea />}
            text="Legislator Analytics"
            helpContent={
              <div className="text-left">
                <ul className="list-disc list-inside space-y-1">
                  <li>These visualizations provide detailed analytics for selected legislators.</li>
                  <li>The Analytics tab shows key metrics like credibility, interactions, and virality.</li>
                  <li>The Topics tab displays topic-specific engagement patterns.</li>
                  <li>The Post Distribution tab shows temporal patterns of activity per topic.</li>
                </ul>
              </div>
            }
          />
          <div className="card shadow-md bg-base-300">
            <div className="card-body p-2">
              <div className="tabs tabs-boxed">
                <a
                  className={`tab gap-2 ${cVal === 0 ? "tab-active" : ""}`}
                  onClick={() => setCVal(0)}
                >
                  <FaSatelliteDish /> Analytics
                </a>
                <a
                  className={`tab gap-2 ${cVal === 1 ? "tab-active" : ""}`}
                  onClick={() => setCVal(1)}
                >
                  <FaClipboardList /> Topics
                </a>
                <a
                  className={`tab gap-2 ${cVal === 2 ? "tab-active" : ""}`}
                  onClick={() => setCVal(2)}
                >
                  <FaChartLine /> Post Distribution
                </a>
              </div>
              <div className="mt-2 overflow-y-auto min-h-[400px]">
                {cVal === 0 && (
                  <Radar
                    axisConfig={axisConfig}
                    width={500}
                    height={400}
                    data={legislatorClicked}
                    activeTopics={activeTopics}
                  />
                )}
                {cVal === 1 && (
                  <Radar
                    axisConfig={axisConfigTopics}
                    width={500}
                    height={400}
                    data={legislatorClicked}
                    activeTopics={activeTopics}
                  />
                )}
                {cVal === 2 && (
                  <RidgeLinePlot
                    height={bounds.height > 0 ? bounds.height / 2 : 300}
                    width={bounds.width}
                    legislatorClicked={legislatorClicked}
                    startDate={startDate}
                    endDate={endDate}
                    activeTopics={activeTopics}
                    legislator={legislator}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LegislatorCharts;
