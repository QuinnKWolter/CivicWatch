import React from "react";
import { Radar } from "./Radar";
import { SummaryLegislatorScatter } from "./SummaryLegislatorScatter";
import { useState } from "react";
import { LineChart } from "./PostLinechart";
import { LegislatorHex } from "./LegislatorHexBin";
function LegislatorCharts({ legislatorClicked, setLegislatorClicked, postData, setPostData, startDate, endDate }) {
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

  const [cVal, setCVal] = useState(0);

  const handleChange = (newValue) => {
    setCVal(newValue);
  }

  return (
    <div>
      {/* <SummaryLegislatorScatter
        width={400}
        height={400}
        legislatorClicked={legislatorClicked}
        setLegislatorClicked={setLegislatorClicked}
        postData={postData}
        setPostData={setPostData}
        startDate={startDate}
        endDate={endDate}
      /> */}
      <LegislatorHex
        width={400}
        height={400}
      />
      
      <div className="flex space-x-2 border-b border-base-300">
      <button
        className={`py-1 px-3 rounded-t ${cVal === 0 ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'}`} onClick={() => handleChange(0)}>
        Radar Accountability
        </button>
      <button className={`py-1 px-3 rounded-5 ${cVal === 1 ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'}`} onClick={() => handleChange(1)}>
        Radar Topics
        </button>
        <button className={`py-1 px-3 rounded-5 ${cVal === 2 ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'}`} onClick={() => handleChange(2)}>
          LineChart Posts
      </button>
      </div>
      <div className="mt-4">
        {cVal === 0 && <Radar
          axisConfig={axisConfig}
          width={300}
          height={300}
          data={legislatorClicked}
        />}
        {cVal === 1 && (
          <Radar
            axisConfig={axisConfigTopics}
            width={300}
            height={300}
            data={legislatorClicked} />
        )}
        {cVal === 2 && (
          <LineChart data={postData} width={300} height={300} />
        )}
      </div>

    </div>
  );
}

export default LegislatorCharts; 

