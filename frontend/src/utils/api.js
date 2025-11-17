/**
 * API utility functions for making requests to the backend
 * All API calls go through the /api proxy configured in vite.config.js
 */

const API_BASE = '/api';

/**
 * Build query string from params object
 */
function buildQueryString(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.append(key, value);
      }
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Get all legislators
 */
export async function getLegislators(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/legislators/${queryString}`);
}

/**
 * Get all states
 */
export async function getStates(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/states/${queryString}`);
}

/**
 * Get engagement timeline data
 */
export async function getEngagementTimeline(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/engagement/timeline/${queryString}`);
}

/**
 * Get topics sorted by engagement
 */
export async function getTopicsByEngagement(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/engagement/topics/${queryString}`);
}

/**
 * Get overview data
 */
export async function getOverviewData(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/default_overview_data/${queryString}`);
}

/**
 * Get legislator profile
 */
export async function getLegislatorProfile(lid, params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/legislators/${lid}/profile${queryString}`);
}

/**
 * Get topic breakdown
 */
export async function getTopicBreakdown(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/topics/breakdown/${queryString}`);
}

/**
 * Get all topics
 */
export async function getAllTopics(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/topics/${queryString}`);
}

