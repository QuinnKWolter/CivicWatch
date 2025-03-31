import { useMemo } from "react";

const TICK_LENGTH = 6;

export const AxisBottom = ({ xScale, pixelsPerTick }) => {
  const range = xScale.range();

  const ticks = useMemo(() => {
    const width = range[1] - range[0];
    const numberOfTicksTarget = Math.floor((width / pixelsPerTick) * 0.3);

    return xScale.ticks(numberOfTicksTarget).map((value) => ({
      value,
      xOffset: xScale(value),
    }));
  }, [xScale]);

  return (
    <>
      <path
        d={["M", range[0], 0, "L", range[1], 0].join(" ")}
        fill="none"
        stroke="#D2D7D3"
      />
      {ticks.map(({ value, xOffset }) => (
        <g key={value} transform={`translate(${xOffset}, 0)`}>
          <line y2={TICK_LENGTH} stroke="currentColor" />
          <text
            key={value}
            style={{
              fontSize: "10px",
              textAnchor: "middle",
              transform: `rotate(-45deg) translate(-20px, 20px)`,
              fill: "#D2D7D3",
            }}
          >
            {value >= 1000 ? `${value / 1000}k` : value}
          </text>
        </g>
      ))}
      <text
        x={(range[0] + range[1]) / 2}
        y={TICK_LENGTH + 50}
        fill="#D2D7D3"
        fontSize="12px"
        fontWeight="bold"
      >
        Total Posts
      </text>
    </>
  );
};
