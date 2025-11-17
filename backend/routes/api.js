import express from 'express';
import { getAllLegislators } from '../controllers/legislatorsController.js';
import { getAllStates } from '../controllers/statesController.js';
import { getDefaultOverviewData } from '../controllers/overviewController.js';
import { getAllTopics, getTopicBreakdown } from '../controllers/topicsController.js';
import { getEngagementTimeline, getTopicsByEngagement } from '../controllers/engagementController.js';
import { getLegislatorProfile } from '../controllers/legislatorProfileController.js';
import { exportPostsCSV } from '../controllers/postsController.js';
import { getDateRange } from '../controllers/datesController.js';

const router = express.Router();

// Date Range
router.get('/date-range/', getDateRange);

// Legislators
router.get('/legislators/', getAllLegislators);

// States
router.get('/states/', getAllStates);

// Posts
router.get('/export-posts-csv/', exportPostsCSV);

// Overview
router.get('/default_overview_data/', getDefaultOverviewData);

// Legislator Profile
router.get('/legislators/:lid/profile', getLegislatorProfile);

// Engagement Timeline (replaces bipartite_data for backward compatibility)
router.get('/flow/bipartite_data/', getEngagementTimeline);

// Topics
router.get('/topics/', getAllTopics);
router.get('/topics/breakdown/', getTopicBreakdown);

// Engagement
router.get('/engagement/timeline/', getEngagementTimeline);
router.get('/engagement/topics/', getTopicsByEngagement);

export default router;

