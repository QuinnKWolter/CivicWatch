import { useEffect, useState } from "react";
import * as d3 from "d3";
import { AxisBasic } from "../AxisBasic";
import { AxisLeft } from "../AxisLeft";
import { AxisBottom } from "../AxisBottom";
import { Tooltip } from "./LegislatorTooltip";
import dayjs from "dayjs";

const MARGIN = { top: 60, right: 60, bottom: 60, left: 60 };

export const SummaryLegislatorScatter = ({
  width,
  height,
  legislatorClicked,
  setLegislatorClicked,
  setPostData,
  postData,
  startDate,
  endDate,
}) => {
  const [data, setData] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);

  const handleLegislatorClick = ({
    name,
    total_misinfo_count_tw,
    total_interactions_tw,
    overperforming_score_tw,
    capitol,
    climate,
    covid,
    gun,
    immigra,
    rights,
    party,
  }) => {
    
    setLegislatorClicked([
      {
        name: name,
        total_misinfo_count_tw: total_misinfo_count_tw,
        total_interactions_tw: total_interactions_tw,
        overperforming_score_tw: overperforming_score_tw,
        capitol: capitol,
        climate: climate,
        covid: covid,
        gun: gun,
        immigra: immigra,
        rights: rights,
        party: party,
      },
    ]);
  };

  useEffect(() => {
    if (legislatorClicked) {
      console.log("Legislator clicked:", legislatorClicked);
    }
  }, [legislatorClicked]);

  useEffect(() => {
    d3.json("/top_50.json")
      .then((jsonData) => {
        setData(jsonData);
      })
      .catch((err) => {
        console.error("Error fetching JSON data:", err);
      });
    d3.json("/matches.json")
      .then((jsonData) => {
        console.log(jsonData[0].created_at);
        console.log("name", legislatorClicked[0].name);
        console.log("START DATE", startDate);
        console.log("END DATE", endDate);
        const filtered_data = jsonData
          .filter((obj) => obj && obj.name)
          .filter((obj, i) => obj.name === legislatorClicked[0].name)
          .filter(
            (obj) =>
              dayjs(obj.created_at) >= startDate &&
              dayjs(obj.created_at) <= endDate
          );

        console.log("filtered data", filtered_data);

        setPostData([...filtered_data]);
      })
      .catch((err) => {
        console.error("Error fetching JSON data:", err);
      });
  }, [endDate, setPostData, startDate, legislatorClicked]);

  if (data.length === 0) {
    return <div>Loading...</div>;
  }

  const boundsWidth = width - MARGIN.right - MARGIN.left;
  const boundsHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = d3
    .scaleLog()
    .domain(d3.extent(data, (d) => d.total_interactions_tw))
    .range([0, boundsWidth]);
  const yScale = d3
    .scaleLog()
    .domain(d3.extent(data, (d) => d.overperforming_score_tw))
    .range([boundsHeight, 0]);

  const points = data.map((d, i) => {
    const color =
      d.party === "R" ? "#FF0000" : d.party === "D" ? "#0000FF" : "#cb1dd1";
    const isDimmed = hoveredGroup && d.party !== hoveredGroup;
    return (
      <circle
        key={i}
        r={3}
        cx={xScale(d.total_interactions_tw)}
        cy={yScale(d.overperforming_score_tw)}
        stroke={color}
        fill={color}
        fillOpacity={0.2}
        strokeWidth={1}
        onMouseEnter={() => {
          setHovered({
            xPos: xScale(d.total_interactions_tw),
            yPos: yScale(d.overperforming_score_tw),
            name: d.name,
          });
          setHoveredGroup(d.party);
        }}
        onClick={() => {
          handleLegislatorClick({
            name: d.name,
            total_misinfo_count_tw: d.total_misinfo_count_tw,
            total_interactions_tw: d.total_interactions_tw,
            overperforming_score_tw: d.overperforming_score_tw,
            capitol: d.capitol,
            climate: d.climate,
            covid: d.covid,
            gun: d.gun,
            immigra: d.immigra,
            rights: d.rights,
            party: d.party,
          });
        }}
        onMouseLeave={() => {
          setHovered(null);
          setHoveredGroup(null);
        }}
        className={isDimmed ? "dimmed" : "circle"}
      />
    );
  });

  return (
    <div style={{ position: "relative" }}>
      <svg width={width} height={height}>
        <g
          width={boundsWidth}
          height={boundsHeight}
          transform={`translate(${MARGIN.left}, ${MARGIN.top})`}
          className="container"
        >
          {/* Y axis */}
          <AxisLeft yScale={yScale} pixelsPerTick={40} width={boundsWidth} />

          {/* X axis, use an additional translation to appear at the bottom */}
          <g transform={`translate(0, ${boundsHeight})`}>
            <AxisBottom
              xScale={xScale}
              pixelsPerTick={40}
              height={boundsHeight}
            />
          </g>

          {/* Circles */}
          {points}
        </g>
      </svg>
      {hovered && (
        <Tooltip
          xPos={hovered.xPos + MARGIN.left + 10} // Add offset to position the tooltip correctly
          yPos={hovered.yPos + MARGIN.top + 10} // Add offset to position the tooltip correctly
          name={hovered.name}
        />
      )}
    </div>
  );
};
