import { useState, useMemo, useRef } from "react";

export const SemanticTooltip = ({ data, width, height }) => {
  if (!data) {
    console.log("returning null");
    return null;
  }

  console.log(data.d)

  return (
      <div
          style={{
              width,
              height,
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none"
        }}>
      <div
        className="absolute bg-black border-4 border-transparent text-white text-[12px] p-[4px] ml-[15px] transform -translate-y-1/2"
        style={{
          position: "absolute",
          left: data.xPos,
          top: data.yPos,
        }}
      >
        <span className="font-bold">Topic: {data.d.topics__name} </span>
        <span></span>
      </div>
    </div>
  );
};
