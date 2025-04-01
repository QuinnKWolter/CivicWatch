import React from "react";
import { Radar } from "./Radar";
import { SummaryLegislatorScatter } from "./SummaryLegislatorScatter";

function LegislatorCharts({ legislatorClicked, setLegislatorClicked, postData, setPostData }) {
  const axisConfig = [
    { name: "total_misinfo_count_tw", max: 2735 },
    { name: "total_interactions_tw", max: 93472549 },
    { name: "overperforming_score_tw", max: 1.296785754 },
  ];

  return (
    <div>
      <SummaryLegislatorScatter
        width={400}
        height={400}
        legislatorClicked={legislatorClicked}
        setLegislatorClicked={setLegislatorClicked}
        postData={postData}
        setPostData={setPostData}
      />
      {legislatorClicked?.length > 0 && (
        <Radar
          axisConfig={axisConfig}
          width={300}
          height={300}
          data={legislatorClicked}
        />
      )}
    </div>
  );
}

export default LegislatorCharts; 