import React, { useEffect, useMemo, useRef } from "react";
import { Radar } from "./Radar";
// import { SummaryLegislatorScatter } from "./SummaryLegislatorScatter";
import { useState } from "react";
// import { LineChart } from "./PostLinechart";
// import { LegislatorHex } from "./LegislatorHexBin";
import { RidgeLinePlot } from "./RidgeLine";
import { LegislatorHeatMap } from "./LegislatorHeatMap";
import { FaSpinner } from "react-icons/fa";
// import { SemanticScatterPlot } from "../Posts/SemanticSimilarity";
import { ChordDiagram } from "../Interactions/ChordDiagram";
import useMeasure from "react-use-measure";

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
}) {
  const [ref, bounds] = useMeasure();

  const axisConfig = useMemo(() => {
    if (!legScatterData || legScatterData.length === 0) return [];

    return [
      {
        display_name: "Low Credibility",
        name: "total_misinfo_count_tw",
        max: Math.max(
          ...legScatterData
            .map((d) => d.total_misinfo_count_tw)
            .filter(Number.isFinite)
        ),
      },
      {
        display_name: "Interactions",
        name: "total_interactions_tw",
        max: Math.max(
          ...legScatterData
            .map((d) => d.total_interactions_tw)
            .filter(Number.isFinite)
        ),
      },
      {
        display_name: "Virality",
        name: "overperforming_score_tw",
        max: Math.max(
          ...legScatterData
            .map((d) => d.overperforming_score_tw)
            .filter(Number.isFinite)
        ),
      },
    ];
  }, [legScatterData]);

  useEffect(() => {
    console.log("does this work", legScatterData);
  }, [legScatterData]);

  const axisConfigTopics = useMemo(() => {
    if (!legScatterData || legScatterData.length === 0) return [];

    return [
      {
        display_name: "Capitol",
        name: "capitol",
        max: Math.max(
          ...legScatterData.map((d) => d.capitol).filter(Number.isFinite)
        ),
      },
      {
        display_name: "Climate",
        name: "climate",
        max: Math.max(
          ...legScatterData.map((d) => d.climate).filter(Number.isFinite)
        ),
      },
      {
        display_name: "Capitol",
        name: "covid",
        max: Math.max(
          ...legScatterData.map((d) => d.covid).filter(Number.isFinite)
        ),
      },
      {
        display_name: "Gun",
        name: "gun",
        max: Math.max(
          ...legScatterData.map((d) => d.gun).filter(Number.isFinite)
        ),
      },
      {
        display_name: "Immigration",
        name: "immigra",
        max: Math.max(
          ...legScatterData.map((d) => d.immigra).filter(Number.isFinite)
        ),
      },
      {
        display_name: "Rights",
        name: "rights",
        max: Math.max(
          ...legScatterData.map((d) => d.rights).filter(Number.isFinite)
        ),
      },
    ];
  });
  // [
  //   { name: "capitol", max: 244 },
  //   { name: "climate", max: 418 },
  //   { name: "covid", max: 2515 },
  //   { name: "gun", max: 427 },
  //   { name: "immigra", max: 384 },
  //   { name: "rights", max: 327 },
  // ];

  const [cVal, setCVal] = useState(0);
  const [dVal, setDVal] = useState(0);
  const [demData, setDemData] = useState([]);
  const [repubData, setRepubData] = useState([]);

  const handleChange = (newValue) => {
    setCVal(newValue);
  };

  const handleDChange = (newValue) => {
    setDVal(newValue);
  };

  useEffect(() => {
    if (!loading) {
      console.log("DATAAAA", monthlyLeg);
      setDemData(monthlyLeg.legislators.filter((d) => d.party === "D"));
      setRepubData(monthlyLeg.legislators.filter((d) => d.party === "R"));
      console.log(
        "repub data",
        monthlyLeg.legislators.filter((d) => d.party === "R")
      );
    }
  }, [monthlyLeg, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading legislator data...</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-2">
      <div className="flex space-x-2 border-b border-base-300 mt-3">
        <button
          className={`py-1 px-3 rounded-t ${
            dVal === 0
              ? "bg-primary text-primary-content"
              : "bg-base-300 text-base-content"
          }`}
          onClick={() => handleDChange(0)}
        >
          Democrat Post Heat Map
        </button>
        <button
          className={`py-1 px-3 rounded-5 ${
            dVal === 1
              ? "bg-primary text-primary-content"
              : "bg-base-300 text-base-content"
          }`}
          onClick={() => handleDChange(1)}
        >
          Republican Post Heat Map
        </button>
      </div>

      <div ref={ref} className=" relative mt-4 overflow-y-auto min-h-[400px]">
        {dVal === 0 && (
          <>
            {/* <LegislatorHeatMap
              width={550}
              height={400}
              startDate={startDate}
              endDate={endDate}
              data={demData}
              legScatterData={legScatterData}
              setLegislatorClicked={setLegislatorClicked}
              party={1}
              legislatorClicked={legislatorClicked}
            /> */}

            {bounds.width > 0 && (
              <ChordDiagram
                width={bounds.width}
                height={bounds.height}
                startDate={startDate}
                endDate={endDate}
                legislator={legislator}
                geojson={geojson}
              />
            )}
          </>

          // <div className="relative">
          //   <SemanticScatterPlot width={400} height={400} data={semanticData.slice(0, 100)} hoveredSemanticDataRef={hoveredSemanticDataRef} />
          // </div>
        )}
        {dVal === 1 && (
          <LegislatorHeatMap
            width={550}
            height={400}
            startDate={startDate}
            endDate={endDate}
            data={repubData}
            legScatterData={legScatterData}
            setLegislatorClicked={setLegislatorClicked}
            party={2}
            legislatorClicked={legislatorClicked}
          />
        )}
      </div>

      <div className="flex space-x-2 border-b border-base-300 mt-3">
        <button
          className={`py-1 px-3 rounded-t ${
            cVal === 0
              ? "bg-primary text-primary-content"
              : "bg-base-300 text-base-content"
          }`}
          onClick={() => handleChange(0)}
        >
          Radar Accountability
        </button>
        <button
          className={`py-1 px-3 rounded-5 ${
            cVal === 1
              ? "bg-primary text-primary-content"
              : "bg-base-300 text-base-content"
          }`}
          onClick={() => handleChange(1)}
        >
          Radar Topics
        </button>
        <button
          className={`py-1 px-3 rounded-5 ${
            cVal === 2
              ? "bg-primary text-primary-content"
              : "bg-base-300 text-base-content"
          }`}
          onClick={() => handleChange(2)}
        >
          Post Ridgeline Plot
        </button>
      </div>

      <div className="mt-4 overflow-y-auto min-h-[400px]">
        {cVal === 0 && (
          <Radar
            axisConfig={axisConfig}
            width={500}
            height={400}
            data={legislatorClicked}
          />
        )}
        {cVal === 1 && (
          <Radar
            axisConfig={axisConfigTopics}
            width={500}
            height={400}
            data={legislatorClicked}
          />
        )}
        {cVal === 2 && (
          // <LineChart
          //   data={postData}
          //   width={300}
          //   height={300}
          // />
          <RidgeLinePlot
            height={800}
            width={500}
            legislatorClicked={legislatorClicked}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </div>
    </div>
  );
}

export default LegislatorCharts;
