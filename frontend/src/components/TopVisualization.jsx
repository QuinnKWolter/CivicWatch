import { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import HelpTooltip from './HelpTooltip';
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
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipContent, setTooltipContent] = useState(null);
  const tippyInstanceRef = useRef(null);

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
        const demPct = (d.data.partyRatio * 100).toFixed(1);
        const repPct = ((1 - d.data.partyRatio) * 100).toFixed(1);
        
        // Create attractive tooltip content
        const content = `
          <div style="padding: 12px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 15px; color: #fff; margin-bottom: 10px; line-height: 1.3;">
              ${d.data.displayName}
            </div>
            <div style="font-size: 13px; color: #e5e7eb; margin-bottom: 8px;">
              <span style="font-weight: 500;">Posts:</span> 
              <span style="color: #fff; font-weight: 600;">${d.data.count.toLocaleString()}</span>
            </div>
            ${d.data.democratic > 0 || d.data.republican > 0 ? `
              <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; margin-top: 8px;">
                <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 12px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; margin-right: 8px;"></div>
                  <span style="color: #d1d5db;">Democratic:</span>
                  <span style="color: #fff; font-weight: 600; margin-left: auto;">${d.data.democratic.toLocaleString()}</span>
                  <span style="color: #9ca3af; margin-left: 6px;">(${demPct}%)</span>
                </div>
                <div style="display: flex; align-items: center; font-size: 12px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; margin-right: 8px;"></div>
                  <span style="color: #d1d5db;">Republican:</span>
                  <span style="color: #fff; font-weight: 600; margin-left: auto;">${d.data.republican.toLocaleString()}</span>
                  <span style="color: #9ca3af; margin-left: 6px;">(${repPct}%)</span>
                </div>
              </div>
            ` : ''}
          </div>
        `;
        
        setTooltipContent(content);
        setTooltipVisible(true);
        
        d3.select(this)
          .attr('stroke-width', 3)
          .attr('opacity', 0.9);
      })
      .on('mousemove', function(event) {
        // Update tooltip position to follow cursor
        if (tippyInstanceRef.current) {
          tippyInstanceRef.current.setProps({
            getReferenceClientRect: () => ({
              width: 0,
              height: 0,
              top: event.clientY,
              bottom: event.clientY,
              left: event.clientX,
              right: event.clientX,
            }),
          });
        }
      })
      .on('mouseout', function() {
        setTooltipVisible(false);
        setTooltipContent(null);
        d3.select(this)
          .attr('stroke-width', 2)
          .attr('opacity', 1);
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
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-lg">Loading topic data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
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
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-lg text-gray-500">Select topics in the sidebar to view treemap</div>
        </div>
      </div>
    );
  }

  // No data available
  if (topicsData.length === 0) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10">
          <HelpTooltip
            content={
              <div className="text-left">
                <p>Visualization of selected topics by engagement and party distribution.</p>
                <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
                <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              </div>
            }
            placement="left"
          />
        </div>
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-lg text-gray-500">No data available for selected topics</div>
        </div>
      </div>
    );
  }

  // Render treemap
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Help icon - floating top right */}
      <div className="absolute top-3 right-3 z-30">
        <HelpTooltip
          content={
            <div className="text-left">
              <p>Visualization of selected topics by engagement and party distribution.</p>
              <p className="mt-2"><strong>Size:</strong> Proportional to number of posts</p>
              <p><strong>Color:</strong> Blue = Democratic, Purple = Mixed, Red = Republican</p>
              <p className="mt-2">Hover over rectangles to see detailed metrics.</p>
            </div>
          }
          placement="left"
        />
      </div>

      {/* Tippy tooltip that follows cursor */}
      <Tippy
        content={<div dangerouslySetInnerHTML={{ __html: tooltipContent || '' }} />}
        visible={tooltipVisible && !!tooltipContent}
        followCursor="initial"
        placement="top"
        animation="scale-subtle"
        duration={[150, 100]}
        delay={[0, 0]}
        arrow={true}
        interactive={false}
        appendTo={() => document.body}
        onMount={(instance) => {
          tippyInstanceRef.current = instance;
        }}
        popperOptions={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 10],
              },
            },
          ],
        }}
        theme="custom-treemap"
      >
        <div style={{ position: 'absolute', pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }} />
      </Tippy>

      {/* Compact legend - bottom right */}
      <div className="absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-gray-200">
        <div className="flex items-center gap-4">
          {/* Color scale indicator */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-4 rounded overflow-hidden shadow-sm border border-white/50">
              <div className="w-3" style={{ backgroundColor: '#dc3545' }}></div>
              <div className="w-3" style={{ backgroundColor: '#764ba2' }}></div>
              <div className="w-3" style={{ backgroundColor: '#2196F3' }}></div>
            </div>
            <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Party</span>
          </div>
          
          {/* Size indicator */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded"></div>
              <div className="w-3 h-3 bg-gray-400 rounded"></div>
              <div className="w-4 h-4 bg-gray-400 rounded"></div>
            </div>
            <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Size = Posts</span>
          </div>
        </div>
      </div>

      {/* Treemap container - full space */}
      <div 
        ref={containerRef} 
        className="w-full h-full" 
      />
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
