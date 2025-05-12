import { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3";

const MARGIN = 30;
const NODE_THICKNESS = 15;
const NODE_CONNECTION_PADDING = 5;

export const ChordDiagram = ({ width, height, startDate, endDate }) => {
  const svgRef = useRef(null);
  const [matrixChordData, setMatrixChordData] = useState([]);
  const [matrixChordNames, setMatrixChordNames] = useState([]);

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
        const filteredData = data.filter((d) => d.count > 0);

        if (filteredData.length === 0) {
          console.log("No data after filtering");
          return;
        }

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

        setMatrixChordData(matrix);
        setMatrixChordNames(allNames);
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

      return chords.groups.map((group, i) => {
        const pathData = arcGenerator(group);
        if (!pathData) {
          console.warn("No path data for group", group);
          return null;
        }
        return (
          <g key={i}>
            <path
              d={pathData}
              fill={`hsl(${(i * 360) / chords.groups.length}, 70%, 50%)`}
              stroke="#333"
              strokeWidth={0.5}
            />
            <text
              transform={`translate(${arcGenerator.centroid(group)})`}
              dy=".35em"
              textAnchor="middle"
              fontSize={10}
              stroke="white"
            >
              {matrixChordNames[i]}
            </text>
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
      const radius = Math.min(width, height) / 2 - MARGIN - NODE_THICKNESS - NODE_CONNECTION_PADDING;
      const chordGenerator = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

      const chords = chordGenerator(matrixChordData);
      
      const ribbonGenerator = d3.ribbon()
        .radius(radius)
        .source(d => d.source)
        .target(d => d.target);

      return chords.map((connection, i) => {
        const d = ribbonGenerator(connection);
        return (
          <path 
            key={i} 
            d={d} 
            fill="red" 
            opacity={0.3} 
            stroke="red"
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