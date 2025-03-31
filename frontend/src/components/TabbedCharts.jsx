import React, { useState } from "react";
import { Box, Tabs, Tab, Typography } from "@mui/material";
import TabA from "./TabA"; // Placeholder for actual chart components
import TabB from "./TabB";
import TabC from "./TabC";
import { Radar } from "./Radar";
import { LineChart } from "./PostLinechart";

function TabbedCharts({ legislatorClicked, postData }) {
  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const legislators = [
    {
      name: "John Smith",
      overperforming_score: 20,
      civility_score: 85,
      count_misinfo: 40,
    },

    // Add more legislators as needed
  ];

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

  // created_at	topic	party	like_count	retweet_count	total_posts	total_interactions

  const posts = [
    { post_id: 1, interaction_score: 0.45, post_accountability_score: 0.62 }, // accountability score some weighted metric?
    { post_id: 2, interaction_score: 0.32, post_accountability_score: 0.92 },
    { post_id: 3, interaction_score: 0.45, post_accountability_score: 0.85 },
    { post_id: 4, interaction_score: 0.29, post_accountability_score: 0.78 },
    { post_id: 5, interaction_score: 0.63, post_accountability_score: 0.89 },
    { post_id: 6, interaction_score: 0.51, post_accountability_score: 0.72 },
    { post_id: 7, interaction_score: 0.38, post_accountability_score: 0.95 },
    { post_id: 8, interaction_score: 0.66, post_accountability_score: 0.88 },
    { post_id: 9, interaction_score: 0.47, post_accountability_score: 0.77 },
    { post_id: 10, interaction_score: 0.34, post_accountability_score: 0.81 },
    { post_id: 11, interaction_score: 0.58, post_accountability_score: 0.9 },
    { post_id: 12, interaction_score: 0.4, post_accountability_score: 0.83 },
    { post_id: 13, interaction_score: 0.49, post_accountability_score: 0.76 },
    { post_id: 14, interaction_score: 0.68, post_accountability_score: 0.93 },
    { post_id: 15, interaction_score: 0.55, post_accountability_score: 0.87 },
    { post_id: 16, interaction_score: 0.37, post_accountability_score: 0.84 },
    { post_id: 17, interaction_score: 0.61, post_accountability_score: 0.8 },
    { post_id: 18, interaction_score: 0.46, post_accountability_score: 0.79 },
    { post_id: 19, interaction_score: 0.33, post_accountability_score: 0.86 },
    { post_id: 20, interaction_score: 0.59, post_accountability_score: 0.91 },
    { post_id: 21, interaction_score: 0.42, post_accountability_score: 0.82 },
    { post_id: 22, interaction_score: 0.36, post_accountability_score: 0.75 },
    { post_id: 23, interaction_score: 0.62, post_accountability_score: 0.88 },
    { post_id: 24, interaction_score: 0.44, post_accountability_score: 0.94 },
    { post_id: 25, interaction_score: 0.5, post_accountability_score: 0.7 },
    { post_id: 26, interaction_score: 0.64, post_accountability_score: 0.89 },
    { post_id: 27, interaction_score: 0.41, post_accountability_score: 0.85 },
    { post_id: 28, interaction_score: 0.56, post_accountability_score: 0.92 },
    { post_id: 29, interaction_score: 0.35, post_accountability_score: 0.73 },
    { post_id: 30, interaction_score: 0.48, post_accountability_score: 0.78 },
    { post_id: 31, interaction_score: 0.6, post_accountability_score: 0.96 },
    { post_id: 32, interaction_score: 0.43, post_accountability_score: 0.74 },
  ];

  const metrics = ["overperforming_score", "civility_score", "count_misinfo"];

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <Tabs value={value} onChange={handleChange} aria-label="chart tabs">
        <Tab label="Tab 1" />
        <Tab label="Tab 2" />
        <Tab label="Tab 3" />
      </Tabs>
      <Box sx={{ p: 3 }}>
        {value === 0 && (
          <>
            <Typography variant="h6">
              {legislatorClicked?.length === 0
                ? "No data"
                : legislatorClicked?.name}
            </Typography>
            <Radar
              axisConfig={axisConfig}
              width={300}
              height={300}
              data={legislatorClicked}
            />
          </>
        )}
        {value === 1 && (
          <>
            <Typography variant="h6">
              {legislatorClicked?.length === 0
                ? "No data"
                : legislatorClicked?.name}
            </Typography>
            {/* <TabB posts={posts}/> */}
            <Radar
              axisConfig={axisConfigTopics}
              width={300}
              height={300}
              data={legislatorClicked}
            />
          </>
        )}
        {value === 2 && (
          <>
            <Typography variant="h6">Tab 3 Content</Typography>
            <LineChart data={postData} width={300} height={300} />
            {/* <TabC /> */}
          </>
        )}
      </Box>
    </Box>
  );
}

export default TabbedCharts;
