import { useMemo } from "react";
import * as d3 from "d3";
import { AxisBottom } from "./AxisBottom";
import { AxisLeft } from "./AxisLeft";

const MARGIN = { top: 30, right: 30, bottom: 50, left: 50 };

export const AxisBasic = ({
  width,
  height,
  boundsWidth,
  boundsHeight,
  xScale,
  yScale,
}) => {
  const logScale = d3
    .scaleLog()
    .domain([0.000000000000000000000001, 10])
    .range(["red", "blue"])
    .clamp(true);

  return (
    <div>
      <g
        width={boundsWidth}
        height={boundsHeight}
        transform={`translate(${[MARGIN.left, MARGIN.top].join(",")})`}
        overflow={"visible"}
      >
        <AxisLeft yScale={yScale} pixelsPerTick={30} width={width} />

        <g transform={`translate(0, ${boundsHeight})`}>
          <AxisBottom xScale={xScale} pixelsPerTick={60} />
        </g>
      </g>
    </div>
  );
};
