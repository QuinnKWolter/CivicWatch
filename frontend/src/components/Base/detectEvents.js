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

export default function detectEvents({ filteredData, activeTopics, detectorMode = 'robust' }) {
  if (!filteredData || !filteredData.length || !activeTopics || !activeTopics.length) return [];

  // Build rows and maybe bin to weekly
  let rows = buildRows(filteredData, activeTopics);
  rows = maybeBinWeekly(rows, activeTopics);
  if (rows.length < 10) return [];

  const values = rows.map(r => r.total);

  // Neighborhood sizing for valley checks (based on rows scale)
  const win = rows.length > 400 ? 8 : 21;
  const half = Math.floor(win / 2);

  // Local robust z using symmetric window (as in current impl)
  const zScores = new Array(values.length).fill(0);
  const mediansArr = new Array(values.length).fill(0);
  const sigmasArr = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length - 1, i + half);
    const windowVals = values.slice(start, end + 1);
    const med = median(windowVals);
    const absDevs = windowVals.map(v => Math.abs(v - med));
    const mad = median(absDevs);
    const sigma = mad > 0 ? 1.4826 * mad : 0;
    zScores[i] = sigma > 0 ? (values[i] - med) / sigma : 0;
    mediansArr[i] = med;
    sigmasArr[i] = sigma;
  }

  let rawEvents = [];
  if (detectorMode === 'robust') {
    // Robust Z with open/close and prominence
    let i = 0;
    while (i < zScores.length) {
      if (zScores[i] >= 3) {
        let startIdx = i;
        let peakIdx = i;
        let peakZ = zScores[i];
        while (i + 1 < zScores.length && zScores[i + 1] > 1) {
          i++;
          if (zScores[i] > peakZ) { peakZ = zScores[i]; peakIdx = i; }
        }
        let endIdx = i;

        const leftValley = Math.min(...values.slice(Math.max(0, startIdx - half), startIdx + 1));
        const rightValley = Math.min(...values.slice(endIdx, Math.min(values.length, endIdx + half + 1)));
        const valley = Math.max(leftValley, rightValley);
        const sigmaAtPeak = sigmasArr[peakIdx] || 0;
        const prominenceVal = values[peakIdx] - valley;
        const prominenceOk = sigmaAtPeak === 0 || (prominenceVal >= 0.5 * sigmaAtPeak);
        if (!prominenceOk) { i++; continue; }

        // Associate topic and max engagement date inside window
        let assocTopic = null, assocIdx = peakIdx, assocVal = -Infinity;
        for (const t of activeTopics) {
          for (let j = startIdx; j <= endIdx; j++) {
            const v = rows[j].topics[t] || 0;
            if (v > assocVal) { assocVal = v; assocTopic = t; assocIdx = j; }
          }
        }
        let maxIdx = startIdx, maxVal = -Infinity;
        for (let j = startIdx; j <= endIdx; j++) {
          if (rows[j].total > maxVal) { maxVal = rows[j].total; maxIdx = j; }
        }
        const totalEngagement = values.slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
        rawEvents.push({
          startIdx, endIdx, peakIdx,
          peakZ,
          startDate: rows[startIdx].date,
          endDate: rows[endIdx].date,
          peakDate: rows[peakIdx].date,
          peakValue: values[peakIdx],
          associatedTopic: assocTopic,
          topicPeakIdx: assocIdx,
          topicPeakDate: rows[assocIdx].date,
          maxIdx,
          maxDate: rows[maxIdx].date,
          baseline: mediansArr[peakIdx] || 0,
          zPeak: zScores[peakIdx] || 0,
          prominence: prominenceVal,
          totalEngagement
        });
      }
      i++;
    }
  } else {
    // Cumulative Z (control graph) tightened with trailing baseline, floor, decay, hysteresis, cooldown, and de-biasing
    const WINDOW = 21;    // trailing days for baseline
    const DECAY = 0.8;    // faster exponential leak
    const Z0 = 1.0;       // ignore small positives
    const C_OPEN = 10;    // open threshold
    const C_CLOSE = 5;    // close threshold (hysteresis)
    const SOFT_CLOSE = 2; // soft close band
    const SOFT_LEN = 2;   // consecutive bins under soft band to close
    const COOL_OFF = 3;   // consecutive bins with z<=0 to force reset
    const ALPHA = 0.15;   // EMA smoothing for de-biasing
    const Z_START_MIN = 1.5; // require decent start
    const Z_PEAK_MIN = 2.5;  // require decent peak
    const MAX_LEN = rows.length > 400 ? 12 : 21; // cap event length (bins)

    // Trailing z (prior-only)
    const zTrail = new Array(values.length).fill(0);
    for (let i = 0; i < values.length; i++) {
      const s = Math.max(0, i - WINDOW);
      const e = i; // exclusive
      const wVals = values.slice(s, e);
      if (wVals.length < 3) { zTrail[i] = 0; continue; }
      const med = median(wVals);
      const mad = median(wVals.map(v => Math.abs(v - med)));
      const sig = mad > 0 ? 1.4826 * mad : 0;
      zTrail[i] = sig > 0 ? (values[i] - med) / sig : 0;
    }

    // De-bias: remove slow positive drift via EMA
    const ema = new Array(values.length).fill(0);
    for (let t = 0; t < values.length; t++) {
      if (t === 0) ema[t] = zTrail[0];
      else ema[t] = ALPHA * zTrail[t] + (1 - ALPHA) * ema[t - 1];
    }
    const zExcess = new Array(values.length).fill(0);
    for (let t = 0; t < values.length; t++) {
      const base = t > 0 ? ema[t - 1] : 0; // causal
      zExcess[t] = zTrail[t] - base;
    }

    // Accumulate with floor, decay, cooldown reset
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

    // Detect intervals with hysteresis and length cap
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
        if (C[t] > peakC) { peakC = C[t]; peakIdx = t; }
        endIdx = t;
        softRun = C[t] <= SOFT_CLOSE ? softRun + 1 : 0;
        length++;
        if (softRun >= SOFT_LEN) { t++; break; }
        t++;
      }

      // Prominence check on E within [startIdx..endIdx]
      const leftSlice = values.slice(startIdx, peakIdx + 1);
      const rightSlice = values.slice(peakIdx, endIdx + 1);
      const leftValley = leftSlice.length ? Math.min(...leftSlice) : values[peakIdx];
      const rightValley = rightSlice.length ? Math.min(...rightSlice) : values[peakIdx];
      const valley = Math.max(leftValley, rightValley);
      const sAtPeak = sigmasArr[peakIdx] || 0;
      const promVal = values[peakIdx] - valley;
      const promOk = sAtPeak === 0 || (promVal >= 0.5 * sAtPeak);
      if (!promOk) continue;

      // Topic association and max engagement date
      let assocTopic = null, assocIdx = peakIdx, assocVal = -Infinity;
      for (const topic of activeTopics) {
        for (let j = startIdx; j <= endIdx; j++) {
          const v = rows[j].topics[topic] || 0;
          if (v > assocVal) { assocVal = v; assocTopic = topic; assocIdx = j; }
        }
      }
      let maxIdx = startIdx, maxVal = -Infinity;
      for (let j = startIdx; j <= endIdx; j++) {
        if (rows[j].total > maxVal) { maxVal = rows[j].total; maxIdx = j; }
      }
      const totalEngagement = values.slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
      rawEvents.push({
        startIdx, endIdx, peakIdx,
        peakZ: zTrail[peakIdx] || 0,
        startDate: rows[startIdx].date,
        endDate: rows[endIdx].date,
        peakDate: rows[peakIdx].date,
        peakValue: values[peakIdx],
        associatedTopic: assocTopic,
        topicPeakIdx: assocIdx,
        topicPeakDate: rows[assocIdx].date,
        maxIdx,
        maxDate: rows[maxIdx].date,
        baseline: mediansArr[peakIdx] || 0,
        zPeak: zTrail[peakIdx] || 0,
        peakC,
        prominence: promVal,
        totalEngagement
      });
    }
  }

  if (!rawEvents.length) return [];

  // Merge close events (time-based window merge consistent with current impl)
  rawEvents.sort((a, b) => a.startDate - b.startDate);
  const merged = [];
  const maxGapMs = rows.length > 400 ? 7 * 24 * 3600 * 1000 : 3 * 24 * 3600 * 1000;
  for (const ev of rawEvents) {
    if (!merged.length) { merged.push({ ...ev }); continue; }
    const last = merged[merged.length - 1];
    if (ev.startDate - last.endDate <= maxGapMs) {
      last.endIdx = Math.max(last.endIdx, ev.endIdx);
      last.endDate = rows[last.endIdx].date;
      if (ev.peakZ > last.peakZ) {
        last.peakZ = ev.peakZ;
        last.peakIdx = ev.peakIdx;
        last.peakDate = ev.peakDate;
        last.peakValue = ev.peakValue;
      }
      if (!last.associatedTopic || ev.peakZ > last.peakZ) {
        last.associatedTopic = ev.associatedTopic;
        last.topicPeakIdx = ev.topicPeakIdx;
        last.topicPeakDate = ev.topicPeakDate;
      }
      if (rows[ev.maxIdx].total > rows[last.maxIdx ?? last.peakIdx].total) {
        last.maxIdx = ev.maxIdx;
        last.maxDate = ev.maxDate;
      }
    } else {
      merged.push({ ...ev });
    }
  }

  merged.sort((a, b) => b.peakZ - a.peakZ);
  return merged.slice(0, 3);
}


