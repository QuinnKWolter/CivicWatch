"""
Generate engagement timeline JSON with only top 50 topics by engagement.

This script processes the CSV and creates a JSON file containing only the
top 50 topic_labels by total engagement, dramatically reducing file size.

Output format: [{ date: '2020-01-01', 'topic_label_1': engagement, ... }, ...]
Only includes top 50 topics, and only non-zero values per day.
"""

import csv
import json
from collections import defaultdict
from datetime import datetime

def generate_top50_engagement_timeline(csv_path, output_path, top_n=50):
    """
    Process CSV and generate engagement timeline JSON with top N topics.
    
    Args:
        csv_path: Path to full_topics.csv
        output_path: Path to output JSON file
        top_n: Number of top topics to include (default: 500)
    """
    # Dictionary to store daily engagement by topic_label
    daily_engagement = defaultdict(lambda: defaultdict(int))
    
    # Track total engagement per topic to find top topics
    topic_totals = defaultdict(int)
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        row_count = 0
        for row in reader:
            row_count += 1
            if row_count % 100000 == 0:
                print(f"  Processed {row_count} rows...")
            
            # Extract date
            created_at = row.get('created_at', '').strip()
            if not created_at:
                continue
            
            # Parse date (format: YYYY-MM-DD)
            try:
                date_obj = datetime.strptime(created_at, '%Y-%m-%d')
                date_str = date_obj.strftime('%Y-%m-%d')
            except ValueError:
                continue
            
            # Filter to date range: 2020-01-01 to 2021-12-31
            if date_str < '2020-01-01' or date_str > '2021-12-31':
                continue
            
            # Extract topic_label
            topic_label = row.get('topic_label', '').strip()
            if not topic_label:
                continue
            
            # Extract engagement metrics
            try:
                like_count = int(row.get('like_count', 0) or 0)
                retweet_count = int(row.get('retweet_count', 0) or 0)
            except (ValueError, TypeError):
                like_count = 0
                retweet_count = 0
            
            # Calculate total engagement
            engagement = like_count + retweet_count
            
            if engagement > 0:
                daily_engagement[date_str][topic_label] += engagement
                topic_totals[topic_label] += engagement
    
    print(f"Total rows processed: {row_count}")
    print(f"Unique dates: {len(daily_engagement)}")
    print(f"Unique topic_labels: {len(topic_totals)}")
    
    # Find top N topics by total engagement
    print(f"\nFinding top {top_n} topics by total engagement...")
    sorted_topics = sorted(topic_totals.items(), key=lambda x: x[1], reverse=True)
    top_topics = set(topic for topic, _ in sorted_topics[:top_n])
    
    print(f"Top {top_n} topics selected:")
    for i, (topic, total) in enumerate(sorted_topics[:10], 1):
        print(f"  {i}. {topic}: {total:,}")
    
    # Convert to list format - only include top topics and non-zero values
    result = []
    
    # Sort dates
    sorted_dates = sorted(daily_engagement.keys())
    
    print(f"\nBuilding JSON structure (top {top_n} topics, non-zero values only)...")
    for date_str in sorted_dates:
        day_data = daily_engagement[date_str]
        
        # Create object with date and only top topics with engagement > 0
        day_obj = {'date': date_str}
        
        # Only add top topics with engagement > 0
        for topic_label, engagement in day_data.items():
            if topic_label in top_topics and engagement > 0:
                day_obj[topic_label] = engagement
        
        # Only add day if it has at least one topic with engagement
        if len(day_obj) > 1:  # More than just 'date'
            result.append(day_obj)
    
    print(f"Writing JSON to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, separators=(',', ':'), ensure_ascii=False)  # Compact format
    
    print(f"✓ Successfully generated {len(result)} daily records")
    
    # Calculate file size
    import os
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✓ File size: {file_size_mb:.2f} MB")
    
    # Print statistics
    if result:
        total_engagement = sum(
            sum(v for k, v in day_obj.items() if k != 'date')
            for day_obj in result
        )
        print(f"✓ Total engagement: {total_engagement:,}")
        print(f"✓ Topics included: {len(top_topics)}")
        print(f"✓ Date range: {result[0]['date']} to {result[-1]['date']}")

if __name__ == '__main__':
    import sys
    import os
    
    # Get paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'full_topics.csv')
    output_path = os.path.join(script_dir, 'engagement_timeline.json')
    
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)
    
    generate_top50_engagement_timeline(csv_path, output_path, top_n=50)

