import * as d3 from "d3";

export const INNER_RADIUS = 40;
const GRID_NUMBER = 5;
const GRID_COLOR = "white";

export const polarToCartesian = (angle, distance) => {
  const x = distance * Math.cos(angle);
  const y = distance * Math.sin(angle);
  return { x, y };
};

export const RadarGrid = ({ outerRadius, xScale, axisConfig }) => {
  const lineGenerator = d3.lineRadial();

  const allAxes = axisConfig.map((axis, i) => {
    const angle = xScale(axis.name);

    if (angle === undefined) {
      return null;
    }

    const path = lineGenerator([
      [angle, INNER_RADIUS],
      [angle, outerRadius],
    ]);

    const labelPosition = polarToCartesian(
      angle - Math.PI / 2,
      outerRadius + 10
    );

    return (
      <g key={i}>
        <path d={path} stroke={GRID_COLOR} strokeWidth={0.5} rx={1} />
        <text
          x={labelPosition.x}
          y={labelPosition.y}
          fontSize={5}
          fill={GRID_COLOR}
          textAnchor={labelPosition.x > 0 ? "start" : "end"}
          dominantBaseline={"middle"}
        >
          {axis.name}
        </text>
      </g>
    );
  });

  const allCircles = [...Array(GRID_NUMBER).keys()].map((position, i) => {
    return (
      <circle
        key={i}
        cx={0}
        cy={0}
        r={
          INNER_RADIUS +
          (position * (outerRadius - INNER_RADIUS)) / (GRID_NUMBER - 1)
        }
        stroke={GRID_COLOR}
        fill="none"
      />
    );
  });

  return (
    <g>
      {allAxes}
      {allCircles}
    </g>
  );
};
