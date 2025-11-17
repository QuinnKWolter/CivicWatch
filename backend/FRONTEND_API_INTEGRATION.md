# Frontend API Integration Summary

## ✅ Completed Work

All frontend components have been updated to use the new PostgreSQL database API instead of static JSON files.

### Backend API Endpoints Created:

1. **`GET /api/legislators/`** - Get all legislators
   - Query params: `party`, `state`, `search`
   - Returns: Array of legislator objects

2. **`GET /api/states/`** - Get all states
   - Query params: `party`
   - Returns: Array of state objects with `abbr` and `name`

3. **`GET /api/engagement/timeline/`** - Get daily engagement timeline
   - Query params: `start_date`, `end_date`, `topics` (array)
   - Returns: Array of daily objects with topic engagement values
   - Format matches `engagement_timeline.json`

4. **`GET /api/engagement/topics/`** - Get topics sorted by engagement
   - Query params: `start_date`, `end_date`, `limit` (default: 500)
   - Returns: Array of topic labels sorted by total engagement

5. **`GET /api/default_overview_data/`** - Get overview metrics
   - Query params: `start_date`, `end_date`, `topics` (array)
   - Returns: Object with `summaryMetrics` by party

6. **`GET /api/legislators/:lid/profile`** - Get legislator profile
   - Query params: `start_date`, `end_date`, `topics` (array)
   - Returns: Detailed legislator profile with metrics and top topics

7. **`GET /api/topics/`** - Get all topics
   - Query params: `start_date`, `end_date`
   - Returns: Array of topic objects with engagement metrics

8. **`GET /api/topics/breakdown/`** - Get topic breakdown
   - Query params: `topic` (required), `start_date`, `end_date`
   - Returns: Topic breakdown with party and state distributions

### Frontend Components Updated:

1. ✅ **`EngagementTimeline.jsx`**
   - Now uses `/api/engagement/timeline/`
   - Supports date range and topic filtering
   - Reloads when filters change

2. ✅ **`Sidebar.jsx`**
   - Now uses `/api/engagement/topics/` for topic list
   - Topics sorted by engagement
   - Supports date range filtering

3. ✅ **`LegislatorDropdown.jsx`**
   - Now uses `/api/legislators/`
   - Supports party and state filtering
   - Client-side search filtering

4. ✅ **`StateDropdown.jsx`**
   - Now uses `/api/states/`
   - Supports party filtering

5. ✅ **`TimelineContext.jsx`**
   - Now uses `/api/default_overview_data/`
   - Supports date range and topic filtering
   - Reloads when filters change

6. ✅ **`LegislatorContext.jsx`**
   - Now uses `/api/legislators/:lid/profile`
   - Supports date range and topic filtering
   - Reloads when filters change

7. ✅ **`TopVisualization.jsx`**
   - Now uses `/api/topics/breakdown/` and `/api/engagement/timeline/`
   - Only loads data for active topics
   - Supports date range filtering

### Configuration Updates:

- ✅ `vite.config.js` - Updated proxy to point to `http://localhost:9000`
- ✅ `backend/server.js` - Default port set to 9000
- ✅ `backend/config/database.js` - Default credentials set to `postgres/postgres`

## ⚠️ IMPORTANT: Database Must Be Set Up First

**The database does not exist yet.** You must:

1. **Create the database:**
   ```powershell
   cd backend
   .\scripts\setup_database.ps1
   ```

2. **Import the CSV data:**
   ```bash
   npm run import-csv
   ```

3. **Verify the import:**
   ```bash
   psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM posts;"
   ```

4. **Start the backend server:**
   ```bash
   npm start
   ```

5. **Start the frontend:**
   ```bash
   cd ../frontend
   npm run dev
   ```

## How It Works

### Data Flow:

1. **User selects filters** (topics, dates, party, state, legislator)
2. **Frontend components** build query parameters
3. **API requests** are made to `/api/*` endpoints
4. **Backend queries** PostgreSQL database with filters
5. **Results** are returned in the same format as the old JSON files
6. **Frontend** renders the data

### Filter Propagation:

- **Date Range**: Passed to all API calls that support it
- **Active Topics**: Passed to engagement timeline, overview, and profile endpoints
- **Party/State**: Used for filtering legislators and states
- **Legislator**: Used for profile endpoint

### Fallback Behavior:

- If API calls fail, components show empty states or default values
- Error messages are logged to console
- No crashes - graceful degradation

## Testing Checklist

Once database is populated:

- [ ] Legislators load in dropdown
- [ ] States load in dropdown
- [ ] Topics load in sidebar (sorted by engagement)
- [ ] Engagement timeline displays data
- [ ] Timeline context shows overview metrics
- [ ] Legislator profiles load when selected
- [ ] Treemap displays selected topics
- [ ] Filters work correctly (date, topic, party, state)
- [ ] Data updates when filters change

## Next Steps

1. **Set up and populate the database** (see `SETUP_INSTRUCTIONS.md`)
2. **Test all endpoints** with populated data
3. **Verify frontend components** work correctly
4. **Optimize queries** if performance issues arise
5. **Add caching** if needed for frequently accessed data

## Notes

- All API endpoints return data in the same format as the old JSON files
- Frontend components maintain backward compatibility with error handling
- Static JSON files are still available as fallback (served from `/static/data/`)
- The old schema controllers are still available but commented out in routes

