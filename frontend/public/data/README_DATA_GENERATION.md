# Data Generation Scripts

This directory contains scripts to generate static JSON files from `full_topics.csv` for use by the CivicWatch frontend.

## Generated Files

### 1. `legislators.json`
**Script:** `generate_legislators.py`  
**Status:** ✅ Generated  
**Description:** List of unique legislators with metadata (lid, name, party, state, chamber, handle)  
**Usage:** Used by `LegislatorDropdown` component

### 2. `states.json`
**Script:** `generate_states.py`  
**Status:** ✅ Generated  
**Description:** List of unique states with post counts (abbr, name, postCount)  
**Usage:** Used by `StateDropdown` component

### 3. `default_overview.json`
**Script:** `generate_default_overview.py`  
**Status:** ⏳ Generating (may take several minutes)  
**Description:** Default aggregated metrics for timeline overview (party breakdowns, totals, etc.)  
**Usage:** Used by `TimelineContext` component

### 4. `legislator_profiles.json`
**Script:** `generate_legislator_profiles.py`  
**Status:** ⏸️ Not yet generated  
**Description:** Per-legislator metrics including rankings and topic breakdowns  
**Usage:** Used by `LegislatorContext` component  
**Note:** This file will be large (~3.5K legislators) and may take 10-15 minutes to generate

## Running the Scripts

All scripts can be run from the `frontend/public/data/` directory:

```bash
# Generate legislators
python generate_legislators.py full_topics.csv legislators.json

# Generate states
python generate_states.py full_topics.csv states.json

# Generate default overview (takes ~5-10 minutes)
python generate_default_overview.py full_topics.csv default_overview.json

# Generate legislator profiles (takes ~10-15 minutes)
python generate_legislator_profiles.py full_topics.csv legislator_profiles.json
```

## Component Updates

All components have been updated to use static JSON files:

- ✅ **LegislatorDropdown** - Now loads from `/data/legislators.json`
- ✅ **StateDropdown** - Now loads from `/data/states.json`
- ✅ **TimelineContext** - Now loads from `/data/default_overview.json`
- ✅ **LegislatorContext** - Ready to load from `/data/legislator_profiles.json` (will use mock data until file is generated)

## Notes

- The `default_overview.json` provides default metrics for the full date range (2020-01-01 to 2021-12-31)
- Future enhancements could add client-side filtering by date range and topics
- The `legislator_profiles.json` file will be large but provides comprehensive per-legislator data
- All scripts filter data to the date range 2020-01-01 to 2021-12-31 to match the engagement timeline data

