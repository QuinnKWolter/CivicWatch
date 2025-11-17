# Database Setup Instructions

## ⚠️ IMPORTANT: Database Must Be Populated First

Before the frontend can use the API endpoints, you **must** set up and populate the PostgreSQL database.

## Quick Setup Steps

### 1. Create Database and Schema

**Windows (PowerShell):**
```powershell
cd backend
.\scripts\setup_database.ps1
```

**Linux/Mac:**
```bash
cd backend
chmod +x scripts/setup_database.sh
./scripts/setup_database.sh
```

**Or manually:**
```bash
# Create database
createdb -U postgres civicwatch

# Run migrations
psql -U postgres -d civicwatch -f migrations/001_create_schema.sql
```

### 2. Import CSV Data

```bash
cd backend
npm run import-csv
```

**Note:** This will take a while depending on the size of your CSV file. The script processes data in batches of 1000 records.

### 3. Verify Import

```bash
psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM posts;"
psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM legislators;"
psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM topics;"
```

### 4. Start Backend Server

```bash
cd backend
npm start
```

The server will run on port 9000 (or PORT from .env).

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will proxy `/api/*` requests to `http://localhost:9000`.

## What Was Updated

### Backend API Endpoints Created:
- `GET /api/legislators/` - Get all legislators (with party/state filtering)
- `GET /api/states/` - Get all states (with party filtering)
- `GET /api/engagement/timeline/` - Get daily engagement timeline
- `GET /api/engagement/topics/` - Get topics sorted by engagement
- `GET /api/default_overview_data/` - Get overview metrics
- `GET /api/legislators/:lid/profile` - Get legislator profile
- `GET /api/topics/` - Get all topics
- `GET /api/topics/breakdown/` - Get topic breakdown with party/state

### Frontend Components Updated:
- ✅ `EngagementTimeline.jsx` - Now uses `/api/engagement/timeline/`
- ✅ `Sidebar.jsx` - Now uses `/api/engagement/topics/` for topic list
- ✅ `LegislatorDropdown.jsx` - Now uses `/api/legislators/`
- ✅ `StateDropdown.jsx` - Now uses `/api/states/`
- ✅ `TimelineContext.jsx` - Now uses `/api/default_overview_data/`
- ✅ `LegislatorContext.jsx` - Now uses `/api/legislators/:lid/profile`
- ✅ `TopVisualization.jsx` - Now uses `/api/topics/breakdown/` and `/api/engagement/timeline/`

## Testing

Once the database is populated, test the API:

```bash
# Test legislators endpoint
curl http://localhost:9000/api/legislators/

# Test states endpoint
curl http://localhost:9000/api/states/

# Test engagement timeline
curl "http://localhost:9000/api/engagement/timeline/?start_date=2020-01-01&end_date=2020-12-31"

# Test topics by engagement
curl http://localhost:9000/api/engagement/topics/?limit=10
```

## Troubleshooting

### Database connection errors
- Check PostgreSQL is running: `pg_isready -U postgres`
- Verify credentials in `.env` file
- Check database exists: `psql -U postgres -l | grep civicwatch`

### Import errors
- Check CSV file path in `.env` or command line
- Verify CSV file has correct column names
- Check PostgreSQL logs for detailed errors

### API errors
- Check backend server is running on port 9000
- Verify database is populated (check row counts)
- Check browser console for API errors
- Check backend logs for SQL errors

### Frontend not loading data
- Verify backend is running: `curl http://localhost:9000/health`
- Check browser Network tab for failed API requests
- Verify Vite proxy is configured correctly in `vite.config.js`

## Next Steps

After setup:
1. All frontend components will automatically use the API
2. Data will be dynamically filtered based on user selections
3. No more static JSON files needed (they're still available as fallback)
4. You can add more API endpoints as needed

