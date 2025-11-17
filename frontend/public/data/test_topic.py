import json

with open('engagement_timeline.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Get the top topic
top_topic = '21_: George Floyd Protests and Justice___'
print(f'Testing with topic: {top_topic}')
print(f'Total days in data: {len(data)}')

days_with_topic = [day for day in data if top_topic in day]
print(f'Days with this topic: {len(days_with_topic)}')

if days_with_topic:
    print(f'\nFirst 5 engagement values:')
    for day in days_with_topic[:5]:
        print(f"  {day['date']}: {day[top_topic]:,}")

