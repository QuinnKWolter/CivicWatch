import useMeasure from 'react-use-measure';
import { SemanticScatterPlot } from "./SemanticSimilarity";
import { FaSpinner } from 'react-icons/fa';
import { useEffect, useState } from 'react';

export const PostCharts = ({ 
  startDate, 
  endDate, 
  semanticData, 
  semanticLoading, 
  hoveredSemanticDataRef,
  keyword,
  setSemanticData,
  legislator
}) => {
  const [ref, bounds] = useMeasure();
  const [filteredData, setFilteredData] = useState([])


  useEffect(() => {
  
  if (!semanticData) return;

  console.log("in postCharts", semanticData)

  let filtered = semanticData;

  const hasKeyword = typeof keyword === "string" && keyword.trim() !== "";
  const hasLegislator = legislator && legislator.name && legislator.name.trim() !== "";
  console.log("keyword", keyword)
  if (hasKeyword) {
    filtered = filtered.filter((d) => d.text.includes(keyword));
    console.log("filtered", filtered)
    
  }

  if (hasLegislator) {
    filtered = filtered.filter((d) => d.name === legislator.name);
  }

  setFilteredData(filtered);
  console.log("filtered", filtered)
}, [keyword, legislator, semanticData]);



  if (semanticLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
        <p className="text-lg">Loading post data...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ paddingTop: '100%' }}>
      <div 
        className="absolute top-0 left-0 w-full h-full" 
        ref={ref}
      >
        {bounds.width > 0 && (
          <SemanticScatterPlot 
            width={bounds.width} 
            height={bounds.height}
            data={filteredData}
            hoveredSemanticDataRef={hoveredSemanticDataRef}
          />
        )}
      </div>
    </div>
  );
};