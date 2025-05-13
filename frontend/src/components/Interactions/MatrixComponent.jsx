import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

const sampleData = {
  civility: 0.8,
  civility2: 0.3,
  misinfo_interaction: 1,
};

export const ChordSquares = ({ x, y, rotate, data, size = 10, width, height, legCivility, legMisinfo, maxMis, maxCiv, legInteractionScore, maxInt}) => {
    const topX = -((3 * size)  / 2)
    return <g transform={`translate(${x}, ${y})`}>
        <rect
            x={topX + 0 * (size)}
            y={ -size / 2}
            width={size}
            height={size}
            fill= {d3.scaleSequentialLog(d3.interpolatePuOr).domain([0.01,maxMis])(legMisinfo)}
            stroke="black"
            transform={"rotate(" + rotate + ")"}
            
        />
        <rect
            x={topX + 1 * (size)}
            y={(-size / 2)}
            width={size}
            height={size}
            fill={d3.scaleSequentialLog(d3.interpolateBlues).domain([0.01,maxCiv])(legCivility)}
            stroke="black"
            transform={"rotate(" + rotate + ")"}
            
        />
        <rect
            x={topX + 2 * (size)}
            y={(-size / 2)}
            width={size}
            height={size}
            stroke="black"
            fill={d3.interpolateGreens(legInteractionScore)}
            transform={"rotate(" + rotate + ")"}
            
      />
  </g>;
};
