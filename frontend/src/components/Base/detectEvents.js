import * as d3 from 'd3';

// Helper: median of numeric array
function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const copy = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(copy.length / 2);
  return copy.length % 2 ? copy[m] : (copy[m - 1] + copy[m]) / 2;
}

// Build per-date rows with topic values (restricted to activeTopics)
function buildRows(filteredData, activeTopics) {
  const rows = filteredData
    .map(d => ({
      date: new Date(d.date),
      topics: Object.fromEntries(activeTopics.map(t => [t, d[t] || 0]))
    }))
    .sort((a, b) => a.date - b.date);
  rows.forEach(r => {
    r.total = activeTopics.reduce((sum, t) => sum + (r.topics[t] || 0), 0);
  });
  return rows;
}

// Optional weekly binning if many points
function maybeBinWeekly(rows, activeTopics) {
  if (rows.length <= 400) return rows;
  const map = new Map();
  for (const r of rows) {
    const wk = d3.timeMonday.floor(r.date).getTime();
    let cur = map.get(wk);
    if (!cur) {
      cur = { date: new Date(wk), topics: {} };
      map.set(wk, cur);
    }
    for (const t of activeTopics) {
      cur.topics[t] = (cur.topics[t] || 0) + (r.topics[t] || 0);
    }
  }
  const binned = Array.from(map.values()).sort((a, b) => a.date - b.date);
  binned.forEach(r => {
    r.total = activeTopics.reduce((sum, t) => sum + (r.topics[t] || 0), 0);
  });
  return binned;
}

// Helper: compute local robust z-scores for a single numeric series
function localRobustZ(values, win) {
  const half = Math.floor(win / 2);
  const n = values.length;
  const z = new Array(n).fill(0);
  const med = new Array(n).fill(0);
  const sig = new Array(n).fill(0);
  
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n - 1, i + half);
    const windowVals = values.slice(start, end + 1);
    const m = median(windowVals);
    const absDevs = windowVals.map(v => Math.abs(v - m));
    const mad = median(absDevs);
    const sigma = mad > 0 ? 1.4826 * mad : 0;
    z[i] = sigma > 0 ? (values[i] - m) / sigma : 0;
    med[i] = m;
    sig[i] = sigma;
  }
  
  return { z, med, sig };
}

// Detect events using robust z-score method on a single topic series
function detectRobustOnSeries(values, win) {
  const { z, med, sig } = localRobustZ(values, win);
  const half = Math.floor(win / 2);
  const events = [];
  
  let i = 0;
  while (i < z.length) {
    if (z[i] >= 3) {
      let startIdx = i;
      let peakIdx = i;
      let peakZ = z[i];
      
      while (i + 1 < z.length && z[i + 1] > 1) {
        i++;
        if (z[i] > peakZ) {
          peakZ = z[i];
          peakIdx = i;
        }
      }
      let endIdx = i;

      // Prominence check on this series
      const leftValley = Math.min(...values.slice(Math.max(0, startIdx - half), startIdx + 1));
      const rightValley = Math.min(...values.slice(endIdx, Math.min(values.length, endIdx + half + 1)));
      const valley = Math.max(leftValley, rightValley);
      const prominenceVal = values[peakIdx] - valley;
      const prominenceOk = sig[peakIdx] === 0 || (prominenceVal >= 0.5 * sig[peakIdx]);
      
      if (prominenceOk) {
        const totalEngagement = values.slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
        events.push({
          startIdx,
          endIdx,
          peakIdx,
          peakZ,
          baseline: med[peakIdx],
          zPeak: z[peakIdx],
          prominence: prominenceVal,
          totalEngagement
        });
      }
    }
    i++;
  }
  
  return events;
}

// Detect events using cumulative z-score method on a single topic series
function detectControlOnSeries(values, win) {
  const WINDOW = 21;
  const DECAY = 0.8;
  const Z0 = 1.0;
  const C_OPEN = 10;
  const C_CLOSE = 5;
  const SOFT_CLOSE = 2;
  const SOFT_LEN = 2;
  const COOL_OFF = 3;
  const ALPHA = 0.15;
  const Z_START_MIN = 1.5;
  const MAX_LEN = values.length > 400 ? 12 : 21;

  // Trailing robust z (prior-only) on this series
  const zTrail = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - WINDOW);
    const end = i; // exclusive
    const windowVals = values.slice(start, end);
    if (windowVals.length < 3) continue;
    
    const med = median(windowVals);
    const mad = median(windowVals.map(v => Math.abs(v - med)));
    const sigma = mad > 0 ? 1.4826 * mad : 0;
    zTrail[i] = sigma > 0 ? (values[i] - med) / sigma : 0;
  }

  // EMA de-bias
  const ema = new Array(values.length).fill(0);
  const zExcess = new Array(values.length).fill(0);
  for (let t = 0; t < values.length; t++) {
    ema[t] = t === 0 ? zTrail[0] : ALPHA * zTrail[t] + (1 - ALPHA) * ema[t - 1];
  }
  for (let t = 0; t < values.length; t++) {
    zExcess[t] = zTrail[t] - (t > 0 ? ema[t - 1] : 0);
  }

  // CUSUM-like accumulation
  const C = new Array(values.length).fill(0);
  let cool = 0;
  for (let t = 0; t < values.length; t++) {
    const prev = t > 0 ? C[t - 1] : 0;
    const inc = Math.max(0, zExcess[t] - Z0);
    cool = zTrail[t] <= 0 ? cool + 1 : 0;
    let candidate = Math.max(0, DECAY * prev + inc);
    if (cool >= COOL_OFF) candidate = 0;
    C[t] = candidate;
  }

  // Find intervals with prominence on this series
  const events = [];
  let t = 0;
  while (t < C.length) {
    while (t < C.length && !(C[t] >= C_OPEN && zExcess[t] >= Z_START_MIN)) t++;
    if (t >= C.length) break;
    
    const startIdx = t;
    let endIdx = t;
    let peakIdx = t;
    let peakC = C[t];
    let softRun = 0;
    let length = 0;
    
    while (t < C.length && C[t] > C_CLOSE && length < MAX_LEN) {
      if (C[t] > peakC) {
        peakC = C[t];
        peakIdx = t;
      }
      endIdx = t;
      softRun = C[t] <= SOFT_CLOSE ? softRun + 1 : 0;
      length++;
      if (softRun >= SOFT_LEN) {
        t++;
        break;
      }
      t++;
    }

    // Prominence check
    const leftValley = Math.min(...values.slice(startIdx, peakIdx + 1));
    const rightValley = Math.min(...values.slice(peakIdx, endIdx + 1));
    const valley = Math.max(leftValley, rightValley);

    // Get local sigma at peak from symmetric robust z for fair scale
    const { sig } = localRobustZ(values, win);
    const prominenceVal = values[peakIdx] - valley;
    const prominenceOk = sig[peakIdx] === 0 || (prominenceVal >= 0.5 * sig[peakIdx]);
    
    if (prominenceOk) {
      const totalEngagement = values.slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
      events.push({
        startIdx,
        endIdx,
        peakIdx,
        peakC,
        peakZ: zTrail[peakIdx],
        zPeak: zTrail[peakIdx],
        prominence: prominenceVal,
        baseline: 0,
        totalEngagement
      });
    }
  }
  
  return events;
}

export default function detectEvents({ filteredData, activeTopics, detectorMode = 'robust' }) {
  if (!filteredData || !filteredData.length || !activeTopics || !activeTopics.length) return [];

  // Build rows and maybe bin to weekly
  let rows = buildRows(filteredData, activeTopics);
  rows = maybeBinWeekly(rows, activeTopics);
  if (rows.length < 10) return [];

  // Neighborhood sizing for valley checks (based on rows scale)
  const win = rows.length > 400 ? 8 : 21;

  // Build per-topic series
  const seriesByTopic = {};
  for (const topic of activeTopics) {
    seriesByTopic[topic] = rows.map(r => r.topics[topic] || 0);
  }

  // Run per-topic detection and tag results with topic
  const perTopicEvents = [];
  for (const topic of activeTopics) {
    const values = seriesByTopic[topic];
    const events = (detectorMode === 'robust' 
      ? detectRobustOnSeries(values, win)
      : detectControlOnSeries(values, win))
      .map(event => ({ ...event, topic }));
    perTopicEvents.push(...events);
  }

  // Helper function to merge events within the same topic
  function mergeEventsSameTopic(events) {
    events.sort((a, b) => a.startIdx - b.startIdx);
    const merged = [];
    const maxGapMs = rows.length > 400 ? 7 * 24 * 3600 * 1000 : 3 * 24 * 3600 * 1000;
    
    for (const event of events) {
      // Add date properties to event
      event.startDate = rows[event.startIdx].date;
      event.endDate = rows[event.endIdx].date;
      event.peakDate = rows[event.peakIdx].date;
      event.peakValue = seriesByTopic[event.topic][event.peakIdx];
      
      // Find max engagement date within the event window
      let maxIdx = event.startIdx;
      let maxVal = -Infinity;
      for (let j = event.startIdx; j <= event.endIdx; j++) {
        if (rows[j].total > maxVal) {
          maxVal = rows[j].total;
          maxIdx = j;
        }
      }
      event.maxIdx = maxIdx;
      event.maxDate = rows[maxIdx].date;
      
      // Set topic association (already known from per-topic detection)
      event.associatedTopic = event.topic;
      event.topicPeakIdx = event.peakIdx;
      event.topicPeakDate = event.peakDate;
      
      if (!merged.length || 
          event.topic !== merged[merged.length - 1].topic ||
          (event.startDate - merged[merged.length - 1].endDate) > maxGapMs) {
        merged.push({ ...event });
      } else {
        const last = merged[merged.length - 1];
        last.endIdx = Math.max(last.endIdx, event.endIdx);
        last.endDate = rows[last.endIdx].date;
        
        // Prefer stronger peak (zPeak or peakC depending on mode)
        const eventStrength = event.zPeak ?? event.peakC ?? 0;
        const lastStrength = last.zPeak ?? last.peakC ?? 0;
        
        if (eventStrength > lastStrength) {
          Object.assign(last, {
            peakIdx: event.peakIdx,
            peakDate: event.peakDate,
            zPeak: event.zPeak,
            peakZ: event.peakZ,
            peakC: event.peakC,
            peakValue: event.peakValue
          });
        }
        
        // Update max engagement if this event has higher total engagement
        if (rows[event.maxIdx].total > rows[last.maxIdx].total) {
          last.maxIdx = event.maxIdx;
          last.maxDate = event.maxDate;
        }
        
        last.totalEngagement += event.totalEngagement;
      }
    }
    
    return merged;
  }

  if (!perTopicEvents.length) return [];

  // Merge events within each topic
  const mergedByTopic = mergeEventsSameTopic(perTopicEvents);

  // Final selection: keep top-k overall
  mergedByTopic.sort((a, b) => {
    const aStrength = a.zPeak ?? a.peakC ?? 0;
    const bStrength = b.zPeak ?? b.peakC ?? 0;
    return bStrength - aStrength;
  });
  
  return mergedByTopic.slice(0, 3);
}
