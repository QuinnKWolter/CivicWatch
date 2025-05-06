import { SemanticScatterPlot } from "./SemanticSimilarity";
import { FaSpinner } from 'react-icons/fa';


export const PostCharts = ({ startDate, endDate, semanticData, semanticLoading, hoveredSemanticDataRef}) => {
    
    console.log("semantic data in postcharts", semanticData);

    if (semanticLoading) {
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FaSpinner className="animate-spin text-4xl text-primary mb-4" />
            <p className="text-lg">Loading legislator data...</p>
          </div>
        );
      }
    
    return (
        <div className="relative">
            <SemanticScatterPlot width={400} height={800} data={semanticData.slice(0, 100)} hoveredSemanticDataRef={hoveredSemanticDataRef} />

        </div>
    )
}