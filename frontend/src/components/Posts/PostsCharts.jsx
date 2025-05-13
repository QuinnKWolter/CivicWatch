import useMeasure from 'react-use-measure';
import { SemanticScatterPlot } from "./SemanticSimilarity";
import { FaSpinner } from 'react-icons/fa';

export const PostCharts = ({ 
  startDate, 
  endDate, 
  semanticData, 
  semanticLoading, 
  hoveredSemanticDataRef
}) => {
  const [ref, bounds] = useMeasure();

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
            data={semanticData?.slice(0, 100) || []}
            hoveredSemanticDataRef={hoveredSemanticDataRef}
          />
        )}
      </div>
    </div>
  );
};