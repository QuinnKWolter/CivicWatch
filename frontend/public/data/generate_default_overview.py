"""
Generate a default overview JSON with basic aggregated metrics.
This is a simplified version that generates default metrics quickly.
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

def generate_default_overview(csv_path, output_path):
    """Generate default overview metrics from CSV."""
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
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        row_count = 0
        for row in reader:
            row_count += 1
            if row_count % 500000 == 0:
                print(f"  Processed {row_count} rows...")
            
            # Filter to date range: 2020-01-01 to 2021-12-31
            created_at = row.get('created_at', '').strip()
            date_obj = parse_date(created_at)
            if not date_obj or date_obj < datetime(2020, 1, 1) or date_obj > datetime(2021, 12, 31):
                continue
            
            party = normalize_party(row.get('party', '').strip())
            if not party:
                continue
            
            state = row.get('state', '').strip().upper()
            lid = row.get('lid', '').strip()
            
            try:
                like_count = int(row.get('like_count', 0) or 0)
                retweet_count = int(row.get('retweet_count', 0) or 0)
                interaction_score = float(row.get('interaction_score', 0) or 0)
                civility_score = float(row.get('civility_score', 1.0) or 1.0)
                count_misinfo = int(row.get('count_misinfo', 0) or 0)
            except (ValueError, TypeError):
                continue
            
            metrics = party_metrics[party]
            metrics['totalPosts'] += 1
            metrics['totalLikes'] += like_count
            metrics['totalRetweets'] += retweet_count
            metrics['totalEngagement'] += like_count + retweet_count
            metrics['totalInteractionScore'] += interaction_score
            
            if civility_score < 0.5:
                metrics['uncivilPosts'] += 1
            if count_misinfo > 0:
                metrics['lowCredibilityPosts'] += 1
            
            if state:
                metrics['states'][state] += 1
            if lid:
                metrics['legislators'].add(lid)
    
    # Convert to final format
    result = {}
    for party, metrics in party_metrics.items():
        most_active_state = max(metrics['states'].items(), key=lambda x: x[1])[0] if metrics['states'] else None
        avg_interaction_score = metrics['totalInteractionScore'] / metrics['totalPosts'] if metrics['totalPosts'] > 0 else 0.0
        
        result[party] = {
            'totalPosts': metrics['totalPosts'],
            'totalLikes': metrics['totalLikes'],
            'totalRetweets': metrics['totalRetweets'],
            'numberLegislators': len(metrics['legislators']),
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
    
    overview_data = {
        'summaryMetrics': result
    }
    
    print(f"Total rows processed: {row_count}")
    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(overview_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")

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
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'default_overview.json'
    generate_default_overview(csv_path, output_path)

