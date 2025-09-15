from django.http import JsonResponse, HttpResponse
from django.db.models import Count, Sum, Avg, Q, F
from django.utils.dateparse import parse_date
from django.conf import settings
from datetime import datetime
import json
import os
import csv

from civicwatch.models import Post, Legislator
from django.db.models.functions import TruncDate


def filter_posts(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topics_param = request.GET.get('topics', '')
    topic_list = [topic.strip() for topic in topics_param.split(',')] if topics_param else []
    keyword = request.GET.get('keyword', '')
    legislator_name = request.GET.get('legislator', '')

    posts_filter = Q()
    if start_date:
        posts_filter &= Q(created_at__gte=parse_date(start_date))
    if end_date:
        posts_filter &= Q(created_at__lte=parse_date(end_date))
    if topic_list:
        posts_filter &= Q(topics__name__in=topic_list)
    if keyword:
        posts_filter &= Q(text__icontains=keyword)
    if legislator_name:
        posts_filter &= Q(legislator__name__iexact=legislator_name)

    return Post.objects.filter(posts_filter).distinct()


def all_legislators(request):
    try:
        legislators = Legislator.objects.values("legislator_id", "name", "state", "party").order_by("state", "name")
        return JsonResponse(list(legislators), safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def bipartite_data(request):
    """
    Returns aggregated daily engagement per topic for the requested date range and topics.
    Query params:
      - start_date: YYYY-MM-DD (optional)
      - end_date:   YYYY-MM-DD (optional)
      - topics:     comma-separated topic names (optional → all topics)

    Response: list of objects, one per day, e.g.
      [{ date: '2020-01-01', abortion: 1234, climate: 567, ... }, ...]
    Values are engagement = like_count + retweet_count per topic summed over parties.
    """
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topics_param = request.GET.get('topics', '')
    topics = [t.strip() for t in topics_param.split(',') if t.strip()] if topics_param else []

    posts_qs = Post.objects.all()

    if start_date:
        posts_qs = posts_qs.filter(created_at__gte=parse_date(start_date))
    if end_date:
        posts_qs = posts_qs.filter(created_at__lte=parse_date(end_date))
    if topics:
        posts_qs = posts_qs.filter(topics__name__in=topics).distinct()

    # Aggregate by day and topic
    aggregated = (
        posts_qs
        .annotate(day=TruncDate('created_at'))
        .values('day', 'topics__name')
        .annotate(
            likes=Sum('like_count'),
            retweets=Sum('retweet_count'),
        )
        .order_by('day')
    )

    # Build compact per-day objects: { date, topicA: engagement, ... }
    day_map = {}
    topic_set = set()
    for row in aggregated:
        day = row['day'].strftime('%Y-%m-%d') if row['day'] else None
        topic = row['topics__name']
        if not day or not topic:
            continue
        engagement = (row['likes'] or 0) + (row['retweets'] or 0)
        topic_set.add(topic)
        if day not in day_map:
            day_map[day] = { 'date': day }
        day_map[day][topic] = engagement

    # If topics were specified, ensure consistent keys; otherwise, use discovered topics
    topic_list = topics if topics else sorted(topic_set)

    # Normalize missing topics to 0 for each day for stack stability
    for day, obj in day_map.items():
        for t in topic_list:
            if t not in obj:
                obj[t] = 0

    # Return days sorted ascending
    data = [day_map[d] for d in sorted(day_map.keys())]
    return JsonResponse(data, safe=False)


def default_overview_data(request):
    json_file_path = os.path.join(os.path.dirname(__file__), '../static/data/defaultOverviewTab.json')
    try:
        with open(json_file_path, 'r') as json_file:
            data = json.load(json_file)
        return JsonResponse(data, safe=False)
    except FileNotFoundError:
        return HttpResponse(status=404, content="Default overview data not found.")


def overview_metrics(request):
    filtered_posts = filter_posts(request).select_related('legislator').distinct()

    summary_metrics = filtered_posts.values('party').annotate(
        total_posts=Count('post_id'),
        avg_interaction_score=Avg('interaction_score'),
        total_likes=Sum('like_count'),
        total_retweets=Sum('retweet_count')
    ).order_by('party')

    summary_metrics_dict = {}
    for item in summary_metrics:
        if item['party'] in ['Democratic', 'Republican']:
            summary_metrics_dict[item['party']] = {
                "totalPosts": item['total_posts'],
                "avgInteractionScore": item['avg_interaction_score'],
                "totalLikes": item['total_likes'],
                "totalRetweets": item['total_retweets']
            }

    for party in ['Democratic', 'Republican']:
        party_posts = filtered_posts.filter(party=party)
        num_legislators = party_posts.values('legislator__legislator_id').distinct().count()
        num_uncivil_posts = party_posts.filter(civility_score__lt=1).count()
        num_misinfo_posts = party_posts.filter(count_misinfo__gt=0).count()
        most_active_state_obj = party_posts.values('state').annotate(post_count=Count('post_id')).order_by('-post_count').first()
        most_active_state = most_active_state_obj['state'] if most_active_state_obj else None

        if party in summary_metrics_dict:
            summary_metrics_dict[party].update({
                "numberLegislators": num_legislators,
                "numUncivilPosts": num_uncivil_posts,
                "numMisinfoPosts": num_misinfo_posts,
                "mostActiveState": most_active_state
            })
        else:
            summary_metrics_dict[party] = {
                "totalPosts": 0,
                "avgInteractionScore": 0,
                "totalLikes": 0,
                "totalRetweets": 0,
                "numberLegislators": 0,
                "numUncivilPosts": 0,
                "numMisinfoPosts": 0,
                "mostActiveState": None
            }

    return JsonResponse({"summaryMetrics": summary_metrics_dict})


def export_posts_csv(request):
    filtered_posts = filter_posts(request)

    response = HttpResponse(content_type='text/csv')
    current_date = datetime.now().strftime('%Y-%m-%d')
    response['Content-Disposition'] = f'attachment; filename="civicwatch_posts_export_{current_date}.csv"'

    writer = csv.writer(response)

    writer.writerow([
        'Post ID', 'Legislator Name', 'Created At', 'Text',
        'State', 'Chamber', 'Party', 'Retweet Count', 'Like Count',
        'Misinfo Count', 'Civility Score', 'Interaction Score', 'Overperforming Score',
        'Topics'
    ])

    filtered_posts = filtered_posts.select_related('legislator').prefetch_related('topics')

    batch_size = 500
    for i in range(0, filtered_posts.count(), batch_size):
        batch = filtered_posts[i:i+batch_size]
        for post in batch:
            topics = ', '.join([topic.name for topic in post.topics.all()])
            writer.writerow([
                post.post_id,
                post.name,
                post.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                post.text,
                post.state,
                post.chamber,
                post.party,
                post.retweet_count,
                post.like_count,
                post.count_misinfo,
                post.civility_score,
                post.interaction_score,
                post.overperforming_score,
                topics
            ])

    return response


