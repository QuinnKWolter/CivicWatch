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
import { active } from "d3";

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

  const axisConfigTopics = useMemo(() => {
    if (!legScatterData || legScatterData.length === 0) return [];

    console.log("SCATTER DATA", legScatterData);

    let topics = [
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
        display_name: "Covid",
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
        display_name: "Immigra",
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
      {
        display_name: "Abortion",
        name: "abortion",
        max: Math.max(
          ...legScatterData.map((d) => d.abortion).filter(Number.isFinite)
        ),
      },
      {
        display_name: "BLM",
        name: "blacklivesmatter",
        max: Math.max(
          ...legScatterData
            .map((d) => d.blacklivesmatter)
            .filter(Number.isFinite)
        ),
      },
    ];

    console.log("ACTIVE TOPICS", activeTopics);

    return topics.filter((d) => activeTopics.includes(d.name.toLowerCase()));
  },[activeTopics, legScatterData]);
  
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

  useEffect(() => {
    if (legislator) {
      const matchInData =
        demData.some((d) => d.name === legislator.name) ||
        repubData.some((d) => d.name === legislator.name);
      console.log("set match")
      setMatch(matchInData);
    }
    console.log("bounds", bounds)
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
      <div ref={ref}>
      {match &&
        <div  className=" relative mt-4 overflow-y-auto min-h-[400px]">
          {dVal === 0 && (
            <>
              {bounds.width > 0 && match && (
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

              {/* {bounds.width > 0 && (
              <ChordDiagram
                width={bounds.width}
                height={bounds.height}
                startDate={startDate}
                endDate={endDate}
                legislator={legislator}
                geojson={geojson}
                setLegislator={setLegislator}
              />
            )} */}
            </>

            // <div className="relative">
            //   <SemanticScatterPlot width={400} height={400} data={semanticData.slice(0, 100)} hoveredSemanticDataRef={hoveredSemanticDataRef} />
            // </div>
          )}
          {dVal === 1 && match && (
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
          </div>}
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
          // <LineChart
          //   data={postData}
          //   width={300}
          //   height={300}
          // />
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
  );
}

export default LegislatorCharts;
