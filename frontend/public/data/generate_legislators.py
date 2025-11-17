"""
Generate legislators.json from full_topics.csv

Extracts unique legislators with their metadata.
Output: Array of legislator objects with lid, name, party, state, chamber, handle
"""

import csv
import json
from collections import defaultdict

def generate_legislators(csv_path, output_path):
    """
    Extract unique legislators from CSV.
    
    Args:
        csv_path: Path to full_topics.csv
        output_path: Path to output JSON file
    """
    legislators_dict = {}
    
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
            
            # If we haven't seen this legislator, add them
            if lid not in legislators_dict:
                name = row.get('name', '').strip()
                party = row.get('party', '').strip()
                state = row.get('state', '').strip()
                chamber = row.get('chamber', '').strip()
                handle = row.get('handle', '').strip()
                
                # Normalize party to single letter
                if party.lower().startswith('democratic'):
                    party = 'D'
                elif party.lower().startswith('republican'):
                    party = 'R'
                elif party:
                    party = party[0].upper()
                
                legislators_dict[lid] = {
                    'legislator_id': lid,
                    'name': name,
                    'party': party,
                    'state': state,
                    'chamber': chamber,
                    'handle': handle
                }
    
    # Convert to sorted list (by name)
    legislators_list = sorted(legislators_dict.values(), key=lambda x: x['name'])
    
    print(f"Total rows processed: {row_count}")
    print(f"Unique legislators found: {len(legislators_list)}")
    
    # Write to JSON
    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(legislators_list, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")

if __name__ == '__main__':
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'full_topics.csv'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'legislators.json'
    generate_legislators(csv_path, output_path)

