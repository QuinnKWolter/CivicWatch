"""
Generate timeline_overview.json from full_topics.csv

Creates aggregated metrics that can be filtered by date range and topics.
Output: Pre-computed metrics for common date ranges and topic combinations.
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
    """Normalize party to Democratic or Republican."""
    if not party:
        return None
    party_lower = party.lower()
    if 'democratic' in party_lower or party_lower.startswith('d'):
        return 'Democratic'
    elif 'republican' in party_lower or party_lower.startswith('r'):
        return 'Republican'
    return None

def generate_timeline_overview(csv_path, output_path):
    """
    Generate aggregated overview metrics from CSV.
    
    Creates a structure that allows filtering by date range and topics.
    """
    # Store all data for processing
    all_posts = []
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        row_count = 0
        for row in reader:
            row_count += 1
            if row_count % 100000 == 0:
                print(f"  Processed {row_count} rows...")
            
            # Extract relevant fields
            created_at = row.get('created_at', '').strip()
            date_obj = parse_date(created_at)
            if not date_obj:
                continue
            
            # Filter to date range: 2020-01-01 to 2021-12-31
            if date_obj < datetime(2020, 1, 1) or date_obj > datetime(2021, 12, 31):
                continue
            
            party = normalize_party(row.get('party', '').strip())
            if not party:
                continue
            
            state = row.get('state', '').strip().upper()
            topic_label = row.get('topic_label', '').strip()
            
            try:
                like_count = int(row.get('like_count', 0) or 0)
                retweet_count = int(row.get('retweet_count', 0) or 0)
                interaction_score = float(row.get('interaction_score', 0) or 0)
                civility_score = float(row.get('civility_score', 1.0) or 1.0)
                count_misinfo = int(row.get('count_misinfo', 0) or 0)
            except (ValueError, TypeError):
                continue
            
            lid = row.get('lid', '').strip()
            
            all_posts.append({
                'date': created_at,
                'party': party,
                'state': state,
                'topic_label': topic_label,
                'lid': lid,
                'like_count': like_count,
                'retweet_count': retweet_count,
                'engagement': like_count + retweet_count,
                'interaction_score': interaction_score,
                'civility_score': civility_score,
                'is_uncivil': civility_score < 0.5,  # Threshold for uncivil
                'is_low_credibility': count_misinfo > 0
            })
    
    print(f"Total valid posts: {len(all_posts)}")
    
    # Generate default overview (all data, all topics)
    print("Generating default overview metrics...")
    default_metrics = calculate_metrics(all_posts, None, None)
    
    # Generate overview structure
    overview_data = {
        'default': default_metrics,
        'dateRange': {
            'start': '2020-01-01',
            'end': '2021-12-31'
        },
        'totalPosts': len(all_posts)
    }
    
    # Write to JSON
    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(overview_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")

def calculate_metrics(posts, start_date=None, end_date=None, topic_labels=None):
    """
    Calculate aggregated metrics for a subset of posts.
    
    Args:
        posts: List of post dictionaries
        start_date: Start date string (YYYY-MM-DD) or None
        end_date: End date string (YYYY-MM-DD) or None
        topic_labels: List of topic labels to filter by, or None for all
    """
    # Filter posts
    filtered_posts = posts
    
    if start_date or end_date:
        filtered_posts = []
        for post in posts:
            post_date = post['date']
            if start_date and post_date < start_date:
                continue
            if end_date and post_date > end_date:
                continue
            filtered_posts.append(post)
    
    if topic_labels:
        filtered_posts = [p for p in filtered_posts if p['topic_label'] in topic_labels]
    
    # Aggregate by party
    party_metrics = defaultdict(lambda: {
        'totalPosts': 0,
        'totalLikes': 0,
        'totalRetweets': 0,
        'totalEngagement': 0,
        'uncivilPosts': 0,
        'lowCredibilityPosts': 0,
        'totalInteractionScore': 0.0,
        'legislators': set(),
        'states': defaultdict(int)
    })
    
    for post in filtered_posts:
        party = post['party']
        if not party:
            continue
        
        metrics = party_metrics[party]
        metrics['totalPosts'] += 1
        metrics['totalLikes'] += post['like_count']
        metrics['totalRetweets'] += post['retweet_count']
        metrics['totalEngagement'] += post['engagement']
        metrics['totalInteractionScore'] += post['interaction_score']
        
        if post['is_uncivil']:
            metrics['uncivilPosts'] += 1
        if post['is_low_credibility']:
            metrics['lowCredibilityPosts'] += 1
        
        if post['state']:
            metrics['states'][post['state']] += 1
        
        if post.get('lid'):
            metrics['legislators'].add(post['lid'])
    
    # Convert to final format
    result = {}
    for party, metrics in party_metrics.items():
        # Find most active state
        most_active_state = max(metrics['states'].items(), key=lambda x: x[1])[0] if metrics['states'] else None
        
        # Calculate averages
        avg_interaction_score = metrics['totalInteractionScore'] / metrics['totalPosts'] if metrics['totalPosts'] > 0 else 0.0
        
        result[party] = {
            'totalPosts': metrics['totalPosts'],
            'totalLikes': metrics['totalLikes'],
            'totalRetweets': metrics['totalRetweets'],
            'numberLegislators': len(metrics['legislators']),  # This would need lid tracking
            'avgInteractionScore': round(avg_interaction_score, 2),
            'mostActiveState': most_active_state,
            'uncivilPosts': metrics['uncivilPosts'],
            'lowCredibilityPosts': metrics['lowCredibilityPosts']
        }
    
    # Ensure both parties exist
    if 'Democratic' not in result:
        result['Democratic'] = create_empty_party_metrics()
    if 'Republican' not in result:
        result['Republican'] = create_empty_party_metrics()
    
    return {'summaryMetrics': result}

def create_empty_party_metrics():
    """Create empty metrics structure for a party."""
    return {
        'totalPosts': 0,
        'totalLikes': 0,
        'totalRetweets': 0,
        'numberLegislators': 0,
        'avgInteractionScore': 0.0,
        'mostActiveState': None,
        'uncivilPosts': 0,
        'lowCredibilityPosts': 0
    }

if __name__ == '__main__':
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'full_topics.csv'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'timeline_overview.json'
    generate_timeline_overview(csv_path, output_path)

