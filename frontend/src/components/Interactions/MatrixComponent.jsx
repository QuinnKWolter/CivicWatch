import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import Tippy from "@tippyjs/react";
import { followCursor } from "tippy.js";

const sampleData = {
  civility: 0.8,
  civility2: 0.3,
  misinfo_interaction: 1,
};

export const ChordSquares = ({
    x,
    y,
    rotate,
    data,
    size = 10,
    width,
    height,
    legCivility,
    legMisinfo,
    maxMis,
    maxCiv,
    legInteractionScore,
    maxInt,
}) => {
    const [toolTipContent, setTooltipContent] = useState("");
    const [tooltipVisible, setTooltipVisible] = useState(false);

    const [topX, setTopX] = useState(0);
    useEffect(() => {
        setTopX(-((3 * size) / 2));
    }, [size]);
    return (
        // <div style={{position:"relative"}}>
        <Tippy
            content={toolTipContent}
            visible={tooltipVisible}
            arrow={false}
            placement="top"
            followCursor={true}
            appendTo={() => document.body}
            plugins={[followCursor]}
        >
      <g transform={`translate(${x}, ${y})`}>
        <rect
          x={topX + 0 * size}
          y={-size / 2}
          width={size}
          height={size}
          fill={d3
            .scaleSequentialLog(d3.interpolateRdBu)
            .domain([0.01, maxMis])(legMisinfo)}
          stroke="black"
          transform={"rotate(" + rotate + ")"}
          onMouseOver={(e) => {
            setTooltipContent(
              <div
                style={{
                  color: "gray",
                  borderRadius: "1px",
                  padding: "0.5px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  height: "100%",
                  width: "100%",
                  lineHeight: "0.8em",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                  }}
                >
                  <strong style={{ fontSize: "0.8em", color: "white" }}>
                    Count Misinformation: {legMisinfo}
                  </strong>
                </div>
              </div>
            );
            setTooltipVisible(true);
          }}
          onMouseOut={(e) => {
            setTooltipVisible(false);
          }}
        />
        <rect
          x={topX + 1 * size}
          y={-size / 2}
          width={size}
          height={size}
          fill={d3
            .scaleSequentialLog(d3.interpolateMagma)
            .domain([0.01, maxCiv])(legCivility)}
          stroke="black"
          transform={"rotate(" + rotate + ")"}
          onMouseOver={(e) => {
            setTooltipContent(
              <div
                style={{
                  color: "gray",
                  borderRadius: "1px",
                  padding: "0.5px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  height: "100%",
                  width: "100%",
                  lineHeight: "0.8em",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                  }}
                >
                  <strong style={{ fontSize: "0.8em", color: "white" }}>
                    Civility: {legCivility}
                  </strong>
                </div>
              </div>
            );
            setTooltipVisible(true);
          }}
          onMouseOut={(e) => {
            setTooltipVisible(false);
          }}
        />
        <rect
          x={topX + 2 * size}
          y={-size / 2}
          width={size}
          height={size}
          stroke="black"
          fill={d3.interpolateGreens(legInteractionScore)}
          transform={"rotate(" + rotate + ")"}
          onMouseOver={(e) => {
            setTooltipContent(
              <div
                style={{
                  color: "gray",
                  borderRadius: "1px",
                  padding: "0.5px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  height: "100%",
                  width: "100%",
                  lineHeight: "0.8em",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                  }}
                >
                  <strong style={{ fontSize: "0.8em", color: "white" }}>
                    Interaction Score: {parseFloat(legInteractionScore).toFixed(2)}
                  </strong>
                </div>
              </div>
            );
            setTooltipVisible(true);
          }}
          onMouseOut={(e) => {
            setTooltipVisible(false);
          }}
        />
      </g>
    </Tippy>
  );
};
