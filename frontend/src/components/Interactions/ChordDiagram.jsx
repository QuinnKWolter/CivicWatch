import { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3";
import { ChordSquares } from "./MatrixComponent";

const MARGIN = 30;
const NODE_THICKNESS = 15;
const NODE_CONNECTION_PADDING = 5;

const partyColor = (party) => {
  if (party === "D") return "#1f77b4"; // Blue
  if (party === "R") return "#d62728"; // Red
  return "#999999";
};

export const ChordDiagram = ({ width, height, startDate, endDate }) => {
  const svgRef = useRef(null);
  const [matrixChordData, setMatrixChordData] = useState([]);
  const [matrixChordNames, setMatrixChordNames] = useState([]);
  const [connectionColors, setConnectionColors] = useState({});
  const [legCivility, setLegCivility] = useState({});
  const [legMisinfo, setLegMisinfo] = useState({});
  const [legInteractionScore, setLegInteractionScore] = useState({})

  const url = "http://localhost:8000/api/chord/chord_interactions/?";

  useEffect(() => {
    const params = {
      start_date: startDate.format("YYYY-MM-DD"),
      end_date: endDate.format("YYYY-MM-DD"),
    };

    const queryParams = new URLSearchParams(params).toString();
    const query = `${url}${queryParams}`;

    fetch(query)
      .then((response) => response.json())
      .then((data) => {
        const filteredData = data.filter(
          (d) =>
            d.count > 0 &&
            d.source_name != d.target_name &&
            d.source_state == "WI" 
        );

        if (filteredData.length === 0) {
          console.log("No data after filtering");
          return;
        }

        
        const idToParty = {};
        filteredData.map((d) => {
          idToParty[d.source_legislator_id] = d.source_party;
        });
        console.log("id", idToParty);

        const sourceIds = filteredData.map((d) => d.source_legislator_id);
        const targetIds = filteredData.map((d) => d.target_legislator_id);
        const allIds = Array.from(new Set([...sourceIds, ...targetIds]));

        const idToIndex = Object.fromEntries(
          allIds.map((id, idx) => [id, idx])
        );

        const n = allIds.length;
        const matrix = Array.from({ length: n }, () => Array(n).fill(0));

        filteredData.forEach((d) => {
          const source = idToIndex[d.source_legislator_id];
          const target = idToIndex[d.target_legislator_id];
          matrix[source][target] += d.count;
          matrix[target][source] += d.count;
        });

        const idToName = {};
        filteredData.forEach((d) => {
          idToName[d.source_legislator_id] = d.source_name;
          idToName[d.target_legislator_id] = d.target_name;
        });
        const allNames = allIds.map((id) => idToName[id]);

        const idToCivility = {};
        filteredData.forEach((d) => {
          idToCivility[d.source_legislator_id] = d.source_civility;
          idToCivility[d.target_legislator_id] = d.target_civility;
        });
        const allCivilities = allIds.map((id) => idToCivility[id])

        const idToMisinfo = {};
        filteredData.forEach((d) => {
          idToMisinfo[d.source_legislator_id] = d.source_civility;
          idToMisinfo[d.target_legislator_id] = d.target_civility;
        });

        const allMisinfo = allIds.map((id) => idToMisinfo[id]);

        const idToInteractionScore = {};
        filteredData.forEach((d) => {
          idToInteractionScore[d.source_legislator_id] = d.source_interaction_score;
          idToInteractionScore[d.target_legislator_id] = d.target_interaction_score;
        })

        const allInteractionScores = allIds.map((id) => idToInteractionScore[id]);

        console.log("allCivilites", allCivilities)
        
        console.log("allnames", allNames)

        console.log("allmisinfos", allMisinfo[19])

        console.log("allinteractions", allInteractionScores)

        setMatrixChordData(matrix);
        setMatrixChordNames(allNames);
        setConnectionColors(idToParty);
        setLegCivility(allCivilities);
        setLegMisinfo(allMisinfo);
        setLegInteractionScore(allInteractionScores)
      })
      .catch((error) => console.error("error fetching chord data", error));
  }, [startDate, endDate]);

  const allNodes = useMemo(() => {
    if (!matrixChordData || matrixChordData.length === 0) return null;

    try {
      const radius = Math.min(width, height) / 2 - MARGIN;
      const chordGenerator = d3
        .chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

      const chords = chordGenerator(matrixChordData);

      const arcGenerator = d3
        .arc()
        .innerRadius(radius - NODE_THICKNESS)
        .outerRadius(radius);

      const outerArc = d3
        .arc()
        .innerRadius(radius + 5)
        .outerRadius(radius + 20);

      return chords.groups.map((group, i) => {
        const angle = (group.startAngle + group.endAngle) / 2;
        const rotate = (angle * 180) / Math.PI - 90;
        const isFlipped = angle > Math.PI;
        const textAnchor = isFlipped ? "end" : "start";
        const transform = `
    rotate(${rotate})
    translate(${Math.min(width, height) / 2 - MARGIN + 10})
    ${isFlipped ? "rotate(180)" : ""}
  `;
        

        const radius = Math.min((width, height / 2 ) - MARGIN + 10);
        const offset = 15;

        const cx = (Math.cos(angle - Math.PI / 2) * (radius + offset))
        const cy = Math.sin(angle - Math.PI / 2) * (radius + offset);

        const maxMis = d3.max(legMisinfo);

        const maxCiv = d3.max(legCivility);

        const maxInt = d3.max(legInteractionScore);

        return (
          <g key={i}>
            <path
              d={arcGenerator(group)}
              fill="#808080"
              stroke="#333"
              strokeWidth={0.5}
            />
            {/* <path
              d={outerArc(group)}
              fill="#FF0000"
              stroke="#FF0000"
              strokeWidth={0.3}
            /> */}
            <text
              transform={transform}
              dy=".35em"
              textAnchor={textAnchor}
              fontSize={10}
              stroke="white"
            >
              {matrixChordNames[i]}
            </text>
            {/* <circle
              cx={cx}
              cy={cy}
              r={2}
              fill="blue"
              strokeWidth={0.3}
            /> */}
            <ChordSquares x={cx} y={cy} rotate={rotate} legCivility={legCivility[i]} legMisinfo={legMisinfo[i]} maxMis={maxMis} maxCiv={maxCiv} maxInt={maxInt} legInteractionScore={legInteractionScore[i]} />
           
          </g>
        );
      });
    } catch (error) {
      console.error("Error generating chord diagram:", error);
      return null;
    }
  }, [matrixChordData, matrixChordNames, height, width]);

  const allConnections = useMemo(() => {
    if (!matrixChordData || matrixChordData.length === 0) return null;

    try {
      const radius =
        Math.min(width, height) / 2 -
        MARGIN -
        NODE_THICKNESS -
        NODE_CONNECTION_PADDING;

      const chordGenerator = d3
        .chordDirected()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

      const chords = chordGenerator(matrixChordData);

      const ribbonGenerator = d3
        .ribbonArrow()
        .radius(radius)
        .source((d) => d.source)
        .target((d) => d.target);

      return chords.map((connection, i) => {
        const sourceIndex = connection.source.index;
        const sourceId = Object.keys(connectionColors)[sourceIndex];
        const party = connectionColors[sourceId];
        const fillColor = partyColor(party);
        const d = ribbonGenerator(connection);

        return (
          <path
            key={i}
            d={d}
            fill={fillColor}
            opacity={0.3}
            stroke={fillColor}
            strokeWidth={0.5}
          />
        );
      });
    } catch (error) {
      console.error("Error generating connections:", error);
      return null;
    }
  }, [matrixChordData, width, height]);

  return (
    <div
      style={{
        width: "100%",
        height: `${height}px`,
        overflowY: "auto",
        border: "1px solid #eee",
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: "1px solid #fff" }}
      >
        {matrixChordData.length > 0 && (
          <g transform={`translate(${width / 2}, ${height / 2})`}>
            {allConnections}
            {allNodes}
          </g>
        )}
      </svg>
    </div>
  );
};
