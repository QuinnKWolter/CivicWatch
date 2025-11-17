"""
Generate legislator_profiles.json from full_topics.csv

Creates per-legislator metrics including rankings and topic breakdowns.
Output: Dictionary keyed by legislator_id with profile data.
"""

import csv
import json
from collections import defaultdict
from datetime import datetime

def parse_date(date_str):
    """Parse date string to datetime object."""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except:
        return None

def normalize_party(party):
    """Normalize party to single letter."""
    if not party:
        return None
    party_lower = party.lower()
    if 'democratic' in party_lower or party_lower.startswith('d'):
        return 'D'
    elif 'republican' in party_lower or party_lower.startswith('r'):
        return 'R'
    return None

def calculate_percentile_rank(value, all_values, reverse=False):
    """Calculate percentile rank (lower is better for reverse=False)."""
    if not all_values:
        return "Top 50%"
    
    sorted_values = sorted(all_values, reverse=reverse)
    rank = sorted_values.index(value) if value in sorted_values else len(sorted_values) // 2
    percentile = (rank / len(sorted_values)) * 100
    
    if percentile <= 5:
        return "Top 5%"
    elif percentile <= 10:
        return "Top 10%"
    elif percentile <= 15:
        return "Top 15%"
    elif percentile <= 20:
        return "Top 20%"
    elif percentile <= 25:
        return "Top 25%"
    elif percentile <= 30:
        return "Top 30%"
    elif percentile <= 40:
        return "Top 40%"
    elif percentile <= 50:
        return "Top 50%"
    else:
        return f"Bottom {100 - int(percentile)}%"

def generate_legislator_profiles(csv_path, output_path):
    """
    Generate per-legislator profile data from CSV.
    """
    # Store legislator data
    legislator_data = defaultdict(lambda: {
        'lid': None,
        'name': None,
        'party': None,
        'state': None,
        'chamber': None,
        'handle': None,
        'posts': [],
        'topics_by_posts': defaultdict(int),
        'topics_by_engagement': defaultdict(int)
    })
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        row_count = 0
        for row in reader:
            row_count += 1
            if row_count % 100000 == 0:
                print(f"  Processed {row_count} rows...")
            
            lid = row.get('lid', '').strip()
            if not lid:
                continue
            
            # Filter to date range: 2020-01-01 to 2021-12-31
            created_at = row.get('created_at', '').strip()
            date_obj = parse_date(created_at)
            if not date_obj or date_obj < datetime(2020, 1, 1) or date_obj > datetime(2021, 12, 31):
                continue
            
            leg_data = legislator_data[lid]
            
            # Set basic info (first occurrence)
            if not leg_data['lid']:
                leg_data['lid'] = lid
                leg_data['name'] = row.get('name', '').strip()
                leg_data['party'] = normalize_party(row.get('party', '').strip())
                leg_data['state'] = row.get('state', '').strip().upper()
                leg_data['chamber'] = row.get('chamber', '').strip()
                leg_data['handle'] = row.get('handle', '').strip()
            
            # Extract metrics
            try:
                like_count = int(row.get('like_count', 0) or 0)
                retweet_count = int(row.get('retweet_count', 0) or 0)
                engagement = like_count + retweet_count
                civility_score = float(row.get('civility_score', 1.0) or 1.0)
                count_misinfo = int(row.get('count_misinfo', 0) or 0)
                topic_label = row.get('topic_label', '').strip()
                platform = 'twitter' if 'twitter' in row.get('handle', '').lower() else 'facebook'
            except (ValueError, TypeError):
                continue
            
            # Store post data
            post_data = {
                'date': created_at,
                'engagement': engagement,
                'like_count': like_count,
                'retweet_count': retweet_count,
                'is_uncivil': civility_score < 0.5,
                'is_low_credibility': count_misinfo > 0,
                'platform': platform,
                'topic_label': topic_label
            }
            leg_data['posts'].append(post_data)
            
            # Track topics
            if topic_label:
                leg_data['topics_by_posts'][topic_label] += 1
                leg_data['topics_by_engagement'][topic_label] += engagement
    
    print(f"Total rows processed: {row_count}")
    print(f"Unique legislators: {len(legislator_data)}")
    
    # Calculate metrics for each legislator
    print("Calculating metrics...")
    profiles = {}
    all_metrics = {
        'totalPosts': [],
        'totalEngagement': [],
        'uncivilPosts': [],
        'lowCredibilityPosts': []
    }
    
    for lid, leg_data in legislator_data.items():
        posts = leg_data['posts']
        
        total_posts = len(posts)
        total_engagement = sum(p['engagement'] for p in posts)
        uncivil_posts = sum(1 for p in posts if p['is_uncivil'])
        low_credibility_posts = sum(1 for p in posts if p['is_low_credibility'])
        
        # Platform breakdown
        twitter_posts = sum(1 for p in posts if p['platform'] == 'twitter')
        facebook_posts = sum(1 for p in posts if p['platform'] == 'facebook')
        twitter_engagement = sum(p['engagement'] for p in posts if p['platform'] == 'twitter')
        facebook_engagement = sum(p['engagement'] for p in posts if p['platform'] == 'facebook')
        
        # Store for percentile calculation
        all_metrics['totalPosts'].append(total_posts)
        all_metrics['totalEngagement'].append(total_engagement)
        all_metrics['uncivilPosts'].append(uncivil_posts)
        all_metrics['lowCredibilityPosts'].append(low_credibility_posts)
        
        # Top topics
        top_topics_by_posts = sorted(
            leg_data['topics_by_posts'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:4]
        
        top_topics_by_engagement = sorted(
            leg_data['topics_by_engagement'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:4]
        
        profiles[lid] = {
            'legislator_id': lid,
            'name': leg_data['name'],
            'party': leg_data['party'],
            'state': leg_data['state'],
            'chamber': leg_data['chamber'],
            'handle': leg_data['handle'],
            'metrics': {
                'totalPosts': total_posts,
                'totalEngagement': total_engagement,
                'uncivilPosts': uncivil_posts,
                'lowCredibilityPosts': low_credibility_posts
            },
            'breakdowns': {
                'posts': {
                    'twitter': twitter_posts,
                    'facebook': facebook_posts
                },
                'engagement': {
                    'likes': sum(p['like_count'] for p in posts),
                    'shares': sum(p['retweet_count'] for p in posts)
                }
            },
            'topTopicsByPosts': [
                {'name': topic, 'value': count, 'topic_label': topic}
                for topic, count in top_topics_by_posts
            ],
            'topTopicsByEngagement': [
                {'name': topic, 'value': engagement, 'topic_label': topic}
                for topic, engagement in top_topics_by_engagement
            ],
            '_raw_metrics': {
                'totalPosts': total_posts,
                'totalEngagement': total_engagement,
                'uncivilPosts': uncivil_posts,
                'lowCredibilityPosts': low_credibility_posts
            }
        }
    
    # Calculate rankings (we'll do this client-side with filters, but store raw metrics)
    print("Finalizing profiles...")
    
    # Write to JSON
    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")
    print(f"  Total profiles: {len(profiles)}")

if __name__ == '__main__':
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'full_topics.csv'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'legislator_profiles.json'
    generate_legislator_profiles(csv_path, output_path)

