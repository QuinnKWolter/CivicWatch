"""
Generate states.json from full_topics.csv

Extracts unique states with post counts.
Output: Array of state objects with abbr, name, postCount
"""

import csv
import json
from collections import defaultdict

# Full state name mapping
STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming'
}

def generate_states(csv_path, output_path):
    """
    Extract unique states with post counts from CSV.
    
    Args:
        csv_path: Path to full_topics.csv
        output_path: Path to output JSON file
    """
    state_counts = defaultdict(int)
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        row_count = 0
        for row in reader:
            row_count += 1
            if row_count % 100000 == 0:
                print(f"  Processed {row_count} rows...")
            
            state = row.get('state', '').strip().upper()
            if state and len(state) == 2:
                state_counts[state] += 1
    
    # Convert to list with full names
    states_list = []
    for abbr in sorted(state_counts.keys()):
        states_list.append({
            'abbr': abbr,
            'name': STATE_NAMES.get(abbr, abbr),
            'postCount': state_counts[abbr]
        })
    
    print(f"Total rows processed: {row_count}")
    print(f"Unique states found: {len(states_list)}")
    
    # Write to JSON
    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(states_list, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")

if __name__ == '__main__':
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'full_topics.csv'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'states.json'
    generate_states(csv_path, output_path)

