# PowerShell setup script for CivicWatch PostgreSQL database

$ErrorActionPreference = "Stop"

Write-Host "Setting up CivicWatch database..." -ForegroundColor Green

# Database connection details
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "civicwatch" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }

# Set password environment variable for psql
$env:PGPASSWORD = $DB_PASSWORD

# Create database if it doesn't exist
Write-Host "Creating database '$DB_NAME' if it doesn't exist..." -ForegroundColor Yellow
$dbExists = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'"

if (-not $dbExists) {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME"
    Write-Host "Database created." -ForegroundColor Green
} else {
    Write-Host "Database already exists." -ForegroundColor Yellow
}

# Run migrations
Write-Host "Running migrations..." -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations\001_create_schema.sql

Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run the import script: node scripts/import_csv.js"
Write-Host "2. After import, refresh views: psql -U $DB_USER -d $DB_NAME -f migrations\002_refresh_materialized_views.sql"

