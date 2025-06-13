import useMeasure from 'react-use-measure';
import { SemanticScatterPlot } from "./SemanticSimilarity";
import { FaSpinner, FaProjectDiagram } from 'react-icons/fa';
import { useEffect, useState } from 'react';

function SectionTitle({ icon, text }) {
  return (
    <h2 className="text-lg flex items-center">
      <span className="mr-1">{icon}</span>
      {text}
    </h2>
  );
}

export const PostsCharts = ({ 
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
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (!semanticData) return;

    let filtered = semanticData;
    const hasKeyword = typeof keyword === "string" && keyword.trim() !== "";
    const hasLegislator = legislator && legislator.name && legislator.name.trim() !== "";

    if (hasKeyword) {
      filtered = filtered.filter((d) => d.text.toLowerCase().includes(keyword.toLowerCase()));
    }

    if (hasLegislator) {
      filtered = filtered.filter((d) => d.name === legislator.name);
    }

    // If no filters are active, show a sample. Otherwise, show all filtered results.
    if (!hasKeyword && !hasLegislator) {
      filtered = semanticData.slice(0, 100);
    }

    setFilteredData(filtered);
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
    <div className="flex flex-col space-y-4 p-2">
      <SectionTitle icon={<FaProjectDiagram />} text="Semantic Similarity of Posts" />
      <div className="card shadow-md bg-base-300">
        <div className="card-body p-2">
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
        </div>
      </div>
    </div>
  );
};