import { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { FaChartBar } from 'react-icons/fa';
import SectionTitle from './SectionTitle';
import { formatTopicLabel, topicNames } from '../utils/utils';

export default function TopVisualization({
  activeTopics,
  startDate,
  endDate,
  // eslint-disable-next-line no-unused-vars
  legislator,
  // eslint-disable-next-line no-unused-vars
  keyword,
  selectedParty = 'both'
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [topicsData, setTopicsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredTopic, setHoveredTopic] = useState(null);

  // Load topics data from API
  useEffect(() => {
    const loadData = async () => {
      if (!activeTopics || activeTopics.length === 0) {
        setLoading(false);
        setTopicsData([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (startDate) {
          params.start_date = typeof startDate.format === 'function' 
            ? startDate.format('YYYY-MM-DD') 
            : startDate;
        }
        if (endDate) {
          params.end_date = typeof endDate.format === 'function' 
            ? endDate.format('YYYY-MM-DD') 
            : endDate;
        }
        if (selectedParty && selectedParty !== 'both') {
          params.party = selectedParty;
        }

        // Get topic breakdowns for all active topics
        const topicBreakdowns = await Promise.all(
          activeTopics.map(async (topicLabel) => {
            try {
              const topicParams = { ...params, topic: topicLabel };
              const queryString = new URLSearchParams();
              Object.entries(topicParams).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  value.forEach(v => queryString.append(key, v));
                } else {
                  queryString.append(key, value);
                }
              });
              const res = await fetch(`/api/topics/breakdown/?${queryString.toString()}`);
              if (!res.ok) {
                console.warn(`Failed to fetch breakdown for topic ${topicLabel}:`, res.status);
                return null;
              }
              const data = await res.json();
              return data;
            } catch (err) {
              console.error(`Error loading breakdown for topic ${topicLabel}:`, err);
              return null;
            }
          })
        );

        // Filter out nulls and transform to treemap format
        const topics = topicBreakdowns
          .filter(t => t !== null && t !== undefined)
          .map(topic => {
            const partyBreakdown = topic.party_breakdown || {};
            const democratic = parseInt(partyBreakdown['Democratic'] || 0);
            const republican = parseInt(partyBreakdown['Republican'] || 0);
            const total = democratic + republican;
            
            // Calculate party ratio (0 = 100% Republican, 0.5 = 50/50, 1 = 100% Democratic)
            let ratio = 0.5; // Default to purple (50/50) if no party data
            if (total > 0) {
              ratio = democratic / total;
            }

            // Use post count as the value (size) for the treemap
            const postCount = Object.values(partyBreakdown).reduce((sum, count) => sum + parseInt(count || 0), 0);

            return {
              name: topic.name || topic.topic_label || topic.topic,
              topicLabel: topic.name || topic.topic_label || topic.topic,
              displayName: topicNames[topic.name] || formatTopicLabel(topic.name || topic.topic_label || topic.topic) || topic.name || topic.topic,
              value: postCount, // Use post count for size
              count: postCount,
              topic: topic.topic,
              partyRatio: ratio,
              democratic: democratic,
              republican: republican,
              partyBreakdown: partyBreakdown,
              stateBreakdown: topic.state_breakdown || {}
            };
          })
          .filter(d => d.value > 0); // Only show topics with posts

        setTopicsData(topics);
        setError(null);
      } catch (err) {
        console.error('Error loading treemap data:', err);
        setError(err.message);
        setTopicsData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTopics, startDate, endDate, selectedParty]);

  // Update dimensions on resize and when container becomes available
  useEffect(() => {
    if (!containerRef.current) {
      // Retry if container isn't ready yet
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial measurement with multiple attempts (React timing issue)
    updateDimensions();
    
    // Retry after a short delay to ensure DOM is ready
    const retryTimeout = setTimeout(updateDimensions, 100);
    const retryTimeout2 = setTimeout(updateDimensions, 300);
    
    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(() => {
      // Debounce dimension updates
      setTimeout(updateDimensions, 50);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      clearTimeout(retryTimeout);
      clearTimeout(retryTimeout2);
      resizeObserver.disconnect();
    };
  }, [topicsData.length]); // Re-run when data changes to ensure dimensions are set

  // Render treemap
  useEffect(() => {
    // Early returns
    if (loading) {
      if (containerRef.current) {
        d3.select(containerRef.current).selectAll('*').remove();
      }
      return;
    }
    
    if (!topicsData || topicsData.length === 0) {
      if (containerRef.current) {
        d3.select(containerRef.current).selectAll('*').remove();
      }
      return;
    }

    // If dimensions aren't set, try to get them from the container
    if (!dimensions.width || !dimensions.height) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
          // Return here - will re-run when dimensions are set
          return;
        }
      }
      // If still no dimensions, wait a bit and retry
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    // Clear previous content
    d3.select(containerRef.current).selectAll('*').remove();

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const width = Math.max(100, dimensions.width - margin.left - margin.right);
    const height = Math.max(100, dimensions.height - margin.top - margin.bottom);

    // Create hierarchy
    const root = d3.hierarchy({ name: 'topics', children: topicsData })
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    d3.treemap()
      .size([width, height])
      .padding(2)
      .round(true)(root);

    // Create SVG
    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Color scale: Blue (1.0 = 100% Dem) -> Purple (0.5 = 50/50) -> Red (0.0 = 100% Rep)
    const colorScale = d3.scaleLinear()
      .domain([0, 0.5, 1])
      .range(['#dc3545', '#764ba2', '#2196F3']); // Red -> Purple -> Blue

    // Get leaves (actual topic nodes)
    const leaves = root.leaves();

    // Add rectangles
    const cells = svg.selectAll('g.cell')
      .data(leaves)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    cells.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => colorScale(d.data.partyRatio || 0.5))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        setHoveredTopic(d.data);
        d3.select(this)
          .attr('stroke-width', 3)
          .attr('opacity', 0.9);
      })
      .on('mouseout', function() {
        setHoveredTopic(null);
        d3.select(this)
          .attr('stroke-width', 2)
          .attr('opacity', 1);
      })
      .append('title')
      .text(d => {
        const demPct = (d.data.partyRatio * 100).toFixed(1);
        const repPct = ((1 - d.data.partyRatio) * 100).toFixed(1);
        return `${d.data.displayName}\nPosts: ${d.data.count.toLocaleString()}\n${demPct}% Democratic, ${repPct}% Republican`;
      });

    // Add text labels (only if rectangle is large enough)
    cells.filter(d => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      return w > 60 && h > 30;
    })
      .append('text')
      .attr('x', 5)
      .attr('y', 15)
      .attr('fill', 'white')
      .attr('font-size', d => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const area = w * h;
        if (area > 10000) return 14;
        if (area > 5000) return 12;
        if (area > 2000) return 10;
        return 8;
      })
      .attr('font-weight', 'bold')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
      .text(d => {
        const name = d.data.displayName;
        const maxLength = Math.floor((d.x1 - d.x0) / 6);
        return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
      });

    // Cleanup function - capture ref value to avoid stale closure
    const container = containerRef.current;
    return () => {
      if (container) {
        d3.select(container).selectAll('*').remove();
      }
    };
  }, [dimensions.width, dimensions.height, topicsData, loading]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col w-full h-full p-2">
        <SectionTitle
          icon={<FaChartBar />}
          text="Topic Treemap"
          helpContent={
            <div className="text-left">
              <p>Visualization of selected topics by engagement and party distribution.</p>
              <p><strong>Size:</strong> Proportional to number of posts</p>
              <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
            </div>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg">Loading topic data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col w-full h-full p-2">
        <SectionTitle
          icon={<FaChartBar />}
          text="Topic Treemap"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-2">Error loading data</div>
            <div className="text-sm text-gray-500">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // No topics selected
  if (!activeTopics || activeTopics.length === 0) {
    return (
      <div className="flex flex-col w-full h-full p-2">
        <SectionTitle
          icon={<FaChartBar />}
          text="Topic Treemap"
          helpContent={
            <div className="text-left">
              <p>Visualization of selected topics by engagement and party distribution.</p>
              <p><strong>Size:</strong> Proportional to number of posts</p>
              <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
            </div>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg text-gray-500">Select topics in the sidebar to view treemap</div>
        </div>
      </div>
    );
  }

  // No data available
  if (topicsData.length === 0) {
    return (
      <div className="flex flex-col w-full h-full p-2">
        <SectionTitle
          icon={<FaChartBar />}
          text="Topic Treemap"
          helpContent={
            <div className="text-left">
              <p>Visualization of selected topics by engagement and party distribution.</p>
              <p><strong>Size:</strong> Proportional to number of posts</p>
              <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
            </div>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg text-gray-500">No data available for selected topics</div>
        </div>
      </div>
    );
  }

  // Render treemap
  return (
    <div className="flex flex-col w-full h-full p-2">
      <SectionTitle
        icon={<FaChartBar />}
        text="Topic Treemap"
        helpContent={
          <div className="text-left">
            <p>Visualization of selected topics by engagement and party distribution.</p>
            <p><strong>Size:</strong> Proportional to number of posts</p>
            <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
            <p className="mt-2">Hover over rectangles to see detailed metrics.</p>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden relative min-h-0">
        {hoveredTopic && (
          <div className="absolute top-4 left-4 z-20 bg-white rounded-lg shadow-lg p-3 border">
            <div className="font-bold text-lg">{hoveredTopic.displayName}</div>
            <div className="text-sm text-gray-600 mt-1">
              Posts: {hoveredTopic.count.toLocaleString()}
            </div>
            {hoveredTopic.democratic > 0 || hoveredTopic.republican > 0 ? (
              <>
                <div className="text-sm text-gray-600 mt-1">
                  Democratic: {hoveredTopic.democratic.toLocaleString()} ({((hoveredTopic.partyRatio) * 100).toFixed(1)}%)
                </div>
                <div className="text-sm text-gray-600">
                  Republican: {hoveredTopic.republican.toLocaleString()} ({((1 - hoveredTopic.partyRatio) * 100).toFixed(1)}%)
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500 mt-1">No party data available</div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 border max-w-xs">
          <div className="font-semibold text-sm text-gray-800 mb-3">Party Distribution</div>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded border-2 border-white shadow-sm" style={{ backgroundColor: '#2196F3' }} />
              <div className="text-sm text-gray-700">100% Democratic</div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded border-2 border-white shadow-sm" style={{ backgroundColor: '#764ba2' }} />
              <div className="text-sm text-gray-700">50/50 Split</div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded border-2 border-white shadow-sm" style={{ backgroundColor: '#dc3545' }} />
              <div className="text-sm text-gray-700">100% Republican</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Rectangle size represents number of posts
            </div>
          </div>
        </div>

        <div 
          ref={containerRef} 
          className="w-full h-full" 
          style={{ minHeight: '300px' }}
        />
      </div>
    </div>
  );
}

TopVisualization.propTypes = {
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  legislator: PropTypes.object,
  keyword: PropTypes.string,
  selectedParty: PropTypes.string
};
