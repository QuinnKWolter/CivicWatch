import * as d3 from 'd3';

function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const copy = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(copy.length / 2);
  return copy.length % 2 ? copy[m] : (copy[m - 1] + copy[m]) / 2;
}

function buildRows(filteredData, activeTopics) {
  const rows = filteredData
    .map(d => {
      const { date, ...topics } = d;
      return { date: new Date(date), topics };
    })
    .sort((a, b) => a.date - b.date);
  
  rows.forEach(r => {
    r.total = activeTopics.reduce((sum, t) => sum + (r.topics[t] || 0), 0);
  });
  return rows;
}

function maybeBinWeekly(rows, activeTopics) {
  if (rows.length <= 400) return rows;
  
  const map = new Map();
  const allTopics = Object.keys(rows[0]?.topics || {});
  
  for (const r of rows) {
    const wk = d3.timeMonday.floor(r.date).getTime();
    let cur = map.get(wk);
    if (!cur) {
      cur = { date: new Date(wk), topics: {} };
      map.set(wk, cur);
    }
    for (const t of allTopics) {
      cur.topics[t] = (cur.topics[t] || 0) + (r.topics[t] || 0);
    }
  }
  
  const binned = Array.from(map.values()).sort((a, b) => a.date - b.date);
  binned.forEach(r => {
    r.total = activeTopics.reduce((sum, t) => sum + (r.topics[t] || 0), 0);
  });
  return binned;
}

export default function detectEvents({ filteredData, activeTopics, detectorMode = 'robust' }) {
  if (!filteredData || !filteredData.length || !activeTopics || !activeTopics.length) return [];

  let rows = buildRows(filteredData, activeTopics);
  rows = maybeBinWeekly(rows, activeTopics);
  if (rows.length < 10) return [];

  // Skip event detection if date range is less than a month
  if (rows.length > 0) {
    const firstDate = rows[0].date;
    const lastDate = rows[rows.length - 1].date;
    const rangeMs = lastDate.getTime() - firstDate.getTime();
    const monthMs = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    if (rangeMs < monthMs) {
      return [];
    }
  }

  // Pre-compute topic values arrays to avoid repeated mapping
  const topicValuesCache = new Map();
  const allPeaks = [];
  
  for (const topic of activeTopics) {
    const topicValues = rows.map(r => r.topics[topic] || 0);
    topicValuesCache.set(topic, topicValues);
    
    // Early exit if no data for this topic
    let hasData = false;
    for (let i = 0; i < topicValues.length; i++) {
      if (topicValues[i] > 0) {
        hasData = true;
        break;
      }
    }
    
    if (hasData) {
      const peaks = findLocalMaxima(topicValues, rows, topic);
      allPeaks.push(...peaks);
    }
  }
  
  if (allPeaks.length === 0) return [];
  
  // Sort by peak value and take top candidates
  allPeaks.sort((a, b) => b.value - a.value);
  const topPeaks = allPeaks.slice(0, 10);
  
  // Determine event boundaries for each peak using cached values
  const allEvents = [];
  for (const peak of topPeaks) {
    const topicValues = topicValuesCache.get(peak.topic);
    const event = determineEventBoundaries(rows, topicValues, peak, detectorMode);
    if (event) {
      allEvents.push(event);
    }
  }
  
  // Remove overlapping events, keeping stronger ones
  const finalEvents = removeOverlappingEvents(allEvents);
  return finalEvents.slice(0, 3);
}

function findLocalMaxima(values, rows, topic) {
  const peaks = [];
  
  // Find max value in single pass instead of Math.max(...values)
  let maxValue = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > maxValue) maxValue = values[i];
  }
  
  const minPeakHeight = maxValue * 0.1;
  
  for (let i = 1; i < values.length - 1; i++) {
    const current = values[i];
    if (current > values[i - 1] && current > values[i + 1] && current > minPeakHeight) {
      peaks.push({
        idx: i,
        value: current,
        date: rows[i].date,
        topic: topic
      });
    }
  }
  
  return peaks;
}

function determineEventBoundaries(rows, values, peak, detectorMode) {
  const peakIdx = peak.idx;
  const topic = peak.topic;
  
  // Calculate Z-scores for boundary detection
  const win = rows.length > 400 ? 8 : 21;
  const half = Math.floor(win / 2);
  const zScores = new Array(values.length);
  const mediansArr = new Array(values.length);
  const sigmasArr = new Array(values.length);
  
  // Pre-allocate arrays to avoid repeated allocations
  const windowVals = new Array(win);
  const absDevs = new Array(win);
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length - 1, i + half);
    const windowSize = end - start + 1;
    
    // Copy window values without slice()
    for (let j = 0; j < windowSize; j++) {
      windowVals[j] = values[start + j];
    }
    
    const med = median(windowVals.slice(0, windowSize));
    
    // Calculate absolute deviations without map()
    for (let j = 0; j < windowSize; j++) {
      absDevs[j] = Math.abs(windowVals[j] - med);
    }
    
    const mad = median(absDevs.slice(0, windowSize));
    const sigma = mad > 0 ? 1.4826 * mad : 0;
    
    zScores[i] = sigma > 0 ? (values[i] - med) / sigma : 0;
    mediansArr[i] = med;
    sigmasArr[i] = sigma;
  }
  
  let startIdx, endIdx;
  
  if (detectorMode === 'robust') {
    // Expand while Z > 1
    startIdx = peakIdx;
    while (startIdx > 0 && zScores[startIdx - 1] > 1) {
      startIdx--;
    }
    
    endIdx = peakIdx;
    while (endIdx < zScores.length - 1 && zScores[endIdx + 1] > 1) {
      endIdx++;
    }
  } else {
    // Expand while Z > 0.5 (more inclusive than robust)
    startIdx = peakIdx;
    while (startIdx > 0 && zScores[startIdx - 1] > 0.5) {
      startIdx--;
    }
    
    endIdx = peakIdx;
    while (endIdx < zScores.length - 1 && zScores[endIdx + 1] > 0.5) {
      endIdx++;
    }
  }
  
  // Validate minimum duration and prominence
  const durationMs = rows[endIdx].date - rows[startIdx].date;
  if (durationMs < 172800000) return null; // 2 * 24 * 60 * 60 * 1000 pre-calculated
  
  // Calculate valleys without slice() and Math.min()
  let leftValley = Infinity;
  const leftStart = Math.max(0, startIdx - half);
  for (let i = leftStart; i <= startIdx; i++) {
    if (values[i] < leftValley) leftValley = values[i];
  }
  
  let rightValley = Infinity;
  const rightEnd = Math.min(values.length - 1, endIdx + half);
  for (let i = endIdx; i <= rightEnd; i++) {
    if (values[i] < rightValley) rightValley = values[i];
  }
  
  const valley = Math.max(leftValley, rightValley);
  const sigmaAtPeak = sigmasArr[peakIdx];
  const prominenceVal = values[peakIdx] - valley;
  
  if (sigmaAtPeak > 0 && prominenceVal < sigmaAtPeak * 0.5) return null;
  
  // Find max engagement within event window
  let maxIdx = startIdx;
  let maxVal = values[startIdx];
  for (let j = startIdx + 1; j <= endIdx; j++) {
    if (values[j] > maxVal) {
      maxVal = values[j];
      maxIdx = j;
    }
  }
  
  return {
    startIdx, endIdx, peakIdx,
    peakZ: zScores[peakIdx],
    startDate: rows[startIdx].date,
    endDate: rows[endIdx].date,
    peakDate: rows[peakIdx].date,
    peakValue: values[peakIdx],
    associatedTopic: topic,
    topicPeakIdx: maxIdx,
    topicPeakDate: rows[maxIdx].date,
    maxIdx,
    maxDate: rows[maxIdx].date,
    baseline: mediansArr[peakIdx],
    zPeak: zScores[peakIdx],
    prominence: prominenceVal,
    totalEngagement: (() => {
      let sum = 0;
      for (let i = startIdx; i <= endIdx; i++) {
        sum += values[i];
      }
      return sum;
    })()
  };
}

function removeOverlappingEvents(events) {
  if (events.length <= 1) return events;
  
  events.sort((a, b) => b.peakValue - a.peakValue);
  const result = [];
  
  for (const event of events) {
    // Use direct date comparison instead of creating new Date objects
    const eventStart = event.startDate.getTime();
    const eventEnd = event.endDate.getTime();
    
    let overlaps = false;
    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      const existingStart = existing.startDate.getTime();
      const existingEnd = existing.endDate.getTime();
      
      if (eventStart <= existingEnd && eventEnd >= existingStart) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      result.push(event);
    }
  }
  
  return result;
}