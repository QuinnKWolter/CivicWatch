from django.shortcuts import render

from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum, Avg, Q, Case, When, IntegerField, F
from .models import Legislator, Post, LegislatorInteraction, Topic
from datetime import datetime, timedelta, date
from django.utils.dateparse import parse_date
from django.db.models import Avg, DateField, Count
from django.db.models.functions import TruncDate, TruncWeek, TruncDay, TruncMonth
from .models import Post
import json
import os
from django.conf import settings
from collections import defaultdict

# 🔹 Helper function: Filter posts by date range and optional criteria
def filter_posts(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topic = request.GET.get('topic')
    
    posts = Post.objects.filter(created_at__range=[start_date, end_date])
    if topic:
        posts = posts.filter(text__icontains=topic)
    
    return posts

# 🔹 Legislator Data API
def all_legislators(request):
    legislators = Legislator.objects.values("legislator_id", "name", "state", "chamber", "party")
    return JsonResponse(list(legislators), safe=False)

def legislator_detail(request, legislator_id):
    legislator = get_object_or_404(Legislator, pk=legislator_id)
    return JsonResponse({"id": legislator.legislator_id, "name": legislator.name, "party": legislator.party, "state": legislator.state})


def legislator_posts_by_month(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    legislator_id = request.GET.get('legislator_id')

    posts_query = Post.objects.all()

    tweet_filters = {}

    #apply date filter
    if start_date:
        tweet_filters['created_at__gte'] = start_date
    if end_date:
        tweet_filters['created_at__lte'] = end_date

    if legislator_id:
        posts_query = posts_query.filter(legislator_id=legislator_id)
    
    legislators_data = (
        posts_query
        .filter(**tweet_filters)
        .annotate(month=TruncMonth('created_at'))
        .values('legislator_id', 'legislator__name', 'month', 'party')
        .annotate(post_count=Count('post_id'))
        .order_by('legislator__name', 'month')
    )

    result = {}
    for entry in legislators_data:
        legislator_id = entry['legislator_id']
        name = entry['legislator__name']
        month = entry['month'].strftime('%Y-%m') if entry['month'] else None
        count = entry['post_count']
        party = entry['party']

        if legislator_id not in result:
            result[legislator_id] = {
                'legislator_id': legislator_id,
                'name' : name,
                'monthly_post_counts' : {},
                'party' : party
            }
        if month:
            result[legislator_id]['monthly_post_counts'][month] = count

    return JsonResponse({'legislators' : list(result.values())})


def legislator_posts_line_chart(request):
    name = request.GET.get("name") 
    start_date = request.GET.get("start_date")
    end_date = request.GET.get("end_date")

    if not name:
        return JsonResponse({"error": "Missing required parameter 'name'"}, status=400)

    legislator = Legislator.objects.filter(name__iexact=name).first()
    if not legislator:
        return JsonResponse({"error": "Legislator not found"}, status=404)

    post_filter = Q(legislator=legislator)
    if start_date:
        post_filter &= Q(created_at__gte=parse_date(start_date))
    if end_date:
        post_filter &= Q(created_at__lte=parse_date(end_date))

   
    grouped_data = (
        Post.objects
        .filter(post_filter)
        .exclude(topics__name=None)
        .annotate(date=TruncDate("created_at"))
        .values("topics__name", "date")
        .annotate(count=Count("post_id"))
        .order_by("topics__name", "date")
    )

   
    response = {}
    for entry in grouped_data:
        topic = entry["topics__name"]
        date = entry["date"].isoformat()
        count = entry["count"]

        if topic not in response:
            response[topic] = []
        response[topic].append({"date": date, "count": count})

    return JsonResponse(response, safe=False)


# 🔹 Topic & Keyword APIs
def all_topics(request):
    topics = Topic.objects.values("id", "name", "description")
    return JsonResponse(list(topics), safe=False)

# 🔹 Bipartite Temporal Flow Diagram APIs
def flow_posts(request):
    posts = filter_posts(request)
    post_counts = posts.values("created_at").annotate(count=Count("post_id"))
    return JsonResponse(list(post_counts), safe=False)

def flow_civility_misinformation(request):
    posts = filter_posts(request)
    stats = posts.aggregate(avg_civility=Avg("civility_score"), avg_misinfo=Avg("count_misinfo"))
    return JsonResponse(stats, safe=False)

def flow_engagement(request):
    posts = filter_posts(request)
    engagement = posts.aggregate(total_likes=Sum("like_count"), total_retweets=Sum("retweet_count"))
    return JsonResponse(engagement, safe=False)

# 🔹 Chord Diagram APIs
def chord_interactions(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    interaction_type = request.GET.get('interaction_type')

    interactions = LegislatorInteraction.objects.filter(date__range=[start_date, end_date])
    if interaction_type:
        interactions = interactions.filter(interaction_type=interaction_type)

    interaction_counts = interactions.values("source_legislator_id", "target_legislator_id").annotate(count=Count("post"))
    return JsonResponse(list(interaction_counts), safe=False)

def chord_top_legislators(request):
    interactions = LegislatorInteraction.objects.values("source_legislator_id").annotate(total_interactions=Count("post_id"))
    return JsonResponse(list(interactions), safe=False)

# 🔹 Geographic Data API
def geo_activity(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    metric = request.GET.get('metric', 'posts')

    posts = filter_posts(request)
    geo_stats = posts.values("state").annotate(total=Count("post_id") if metric == "posts" else Sum("like_count"))
    
    return JsonResponse(list(geo_stats), safe=False)

def geo_activity_topics(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    metric = request.GET.get('metric', 'posts')

    topics_param = request.GET.get('topics', '')
    topic_list = [topic.strip() for topic in topics_param.split(',')] if topics_param else []

    posts = Post.objects.all()

    if start_date:
        posts = posts.filter(created_at__gte=start_date)
    if end_date:
        posts = posts.filter(created_at__lte=end_date)

    if topic_list:
        posts = posts.filter(topics__name__in=topic_list).distinct()

    geo_stats = []

    if metric == 'posts':
        post_counts = posts.values('state', 'party').annotate(total=Count('post_id'))
        geo_stats = list(post_counts)

    elif metric == 'legislators':
        legislator_counts = posts.values('state', 'party', 'legislator_id').distinct().annotate(
            legislator_count=Count('legislator_id', distinct=True)
        )
        geo_stats = list(legislator_counts)

    elif metric == 'engagement':
        unique_post_ids = posts.values_list('post_id', flat=True).distinct()
        filtered_posts = Post.objects.filter(post_id__in=unique_post_ids)

        engagement_data = filtered_posts.values('state', 'party').annotate(
            total_engagement=Sum(F('like_count') + F('retweet_count'))
        )
        geo_stats = list(engagement_data)

    state_party_data = {}
    for entry in geo_stats:
        state = entry['state']
        party = entry['party']

        if party not in ['Democratic', 'Republican']:
            party = 'Other'

        total = (
            entry['total'] if metric == 'posts'
            else entry['legislator_count'] if metric == 'legislators'
            else entry['total_engagement']
        )

        if state not in state_party_data:
            state_party_data[state] = {
                'state': state,
                'Democratic': 0,
                'Republican': 0,
                'Other': 0,
                'total': 0
            }

        state_party_data[state][party] += total
        state_party_data[state]['total'] += total

    return JsonResponse(list(state_party_data.values()), safe=False)


# 🔹 Post Exploration APIs
def all_posts(request):
    posts = filter_posts(request)
    post_list = posts.values("post_id", "text", "created_at", "like_count", "retweet_count", "civility_score", "count_misinfo")
    return JsonResponse(list(post_list), safe=False)

def top_posts(request):
    posts = filter_posts(request).order_by("-like_count")[:10]
    post_list = posts.values("post_id", "text", "like_count", "retweet_count")
    return JsonResponse(list(post_list), safe=False)

# def legislators_scatter_data(request):
#     start_date = request.GET.get('start_date')
#     end_date = request.GET.get('end_date')

#     legislators = Legislator.objects.all()

#     topic_keywords = ["abortion", "blacklivesmatter", "capitol", "climate", "covid", "gun", "immigra", "rights"]

#     posts_filter = Q()
#     if start_date:
#         start_date = parse_date(start_date)
#         posts_filter &= Q(created_at__gte=start_date)
#     if end_date:
#         end_date = parse_date(end_date)
#         posts_filter &= Q(created_at__lte=end_date)

#     data = []
#     for legislator in legislators:
#         posts = legislator.tweets.filter(posts_filter)

#         topic_counts = {topic: posts.filter(text__icontains=topic).count() for topic in topic_keywords}

#         data.append({
#             "name": legislator.name,
#             "state": legislator.state,
#             "chamber": legislator.chamber,
#             "party": legislator.party,
#             "lid": legislator.legislator_id,
#             "total_posts_tw": posts.count(),
#             "total_likes_tw": posts.aggregate(total_likes=Sum("like_count"))["total_likes"] or 0,
#             "total_retweets_tw": posts.aggregate(total_retweets=Sum("retweet_count"))["total_retweets"] or 0,
#             "total_misinfo_count_tw": posts.aggregate(total_misinfo=Sum("count_misinfo"))["total_misinfo"] or 0,
#             "total_interactions_tw": posts.aggregate(total_interactions=Sum("like_count") + Sum("retweet_count"))["total_interactions"] or 0,
#             "interaction_score_tw": legislator.interaction_score_tw,
#             "overperforming_score_tw": legislator.overperforming_score_tw,
#             "civility_score_tw": legislator.civility_score_tw,
#             **topic_counts  # Add topic data dynamically
#         })

#     return JsonResponse(data, safe=False)


def legislators_scatter_data(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    posts_filter = Q()
    if start_date:
        start_date = parse_date(start_date)
        posts_filter &= Q(tweets__created_at__gte=start_date)
    if end_date:
        end_date = parse_date(end_date)
        posts_filter &= Q(tweets__created_at__lte=end_date)

    topic_keywords = ["abortion", "blacklivesmatter", "capitol", "climate", "covid", "gun", "immigra", "rights"]

    # Build dynamic Case/When expressions for topic counts
    topic_annotations = {
        f"{topic}_count": Count(
            Case(
                When(tweets__text__icontains=topic, then=1),
                output_field=IntegerField()
            )
        )
        for topic in topic_keywords
    }

    legislators = Legislator.objects.annotate(
        total_posts_tw_count=Count("tweets", filter=posts_filter, distinct=True),
        total_likes_tw_count=Sum("tweets__like_count", filter=posts_filter),
        total_retweets_tw_count=Sum("tweets__retweet_count", filter=posts_filter),
        total_misinfo_count_tw_count=Sum("tweets__count_misinfo", filter=posts_filter),
        **topic_annotations
    ).filter(posts_filter).distinct()

    data = []
    for leg in legislators:
        data.append({
            "name": leg.name,
            "state": leg.state,
            "chamber": leg.chamber,
            "party": leg.party,
            "lid": leg.legislator_id,
            "total_posts_tw_count": leg.total_posts_tw_count,
            "total_likes_tw": leg.total_likes_tw_count or 0,
            "total_retweets_tw": leg.total_retweets_tw_count or 0,
            "total_misinfo_count_tw": leg.total_misinfo_count_tw_count or 0,
            "total_interactions_tw": (leg.total_likes_tw_count or 0) + (leg.total_retweets_tw_count or 0),
            "interaction_score_tw": leg.interaction_score_tw,
            "overperforming_score_tw": leg.overperforming_score_tw,
            "civility_score_tw": leg.civility_score_tw,
            **{topic: getattr(leg, f"{topic}_count", 0) for topic in topic_keywords}
        })

    return JsonResponse(data, safe=False)


def bipartite_flow_data(request):
    print("Starting bipartite_flow_data function")
    
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    # Build the filter condition
    posts_filter = Q()
    if start_date and end_date:
        start_date = parse_date(start_date)
        end_date = parse_date(end_date)
        posts_filter = Q(created_at__range=(start_date, end_date))
        print(f"Received date range: {start_date} to {end_date}")
    else:
        print("No date range provided, querying all posts")

    print(f"Built posts filter: {posts_filter}")

    # Query posts and group by date, topic, and party
    print("Querying posts data...")
    posts = Post.objects.filter(posts_filter).values('created_at__date', 'topics__name', 'legislator__party').annotate(
        post_count=Count('post_id'),
        total_likes=Sum('like_count'),
        total_shares=Sum('retweet_count')
    )
    print(f"Found {len(posts)} post records")

    # Prepare the response data
    print("Building response data structure...")
    response_data = {}
    # Insert empty data for January 1st, 2020
    # empty_date = "2020-01-01"
    # response_data[empty_date] = {}
    # for topic in ['abortion', 'blacklivesmatter', 'climate', 'gun', 'immigra', 'rights']:
    #     response_data[empty_date][topic] = {
    #         'D': {'posts': 0, 'legislators': set(), 'likes': 0, 'shares': 0},
    #         'R': {'posts': 0, 'legislators': set(), 'likes': 0, 'shares': 0}
    #     }
    for post in posts:
        date = post['created_at__date']
        topic = post['topics__name']
        party = post['legislator__party']
        if date not in response_data:
            response_data[date] = {}
        if topic not in response_data[date]:
            response_data[date][topic] = {}
        if party not in response_data[date][topic]:
            response_data[date][topic][party] = {
                'posts': 0,
                'legislators': set(),
                'likes': 0,
                'shares': 0
            }
        response_data[date][topic][party]['posts'] += post['post_count']
        response_data[date][topic][party]['likes'] += post['total_likes']
        response_data[date][topic][party]['shares'] += post['total_shares']

    # Query legislators and add to the response data
    print("Querying legislator data...")
    for post in Post.objects.filter(posts_filter).select_related('legislator').values('created_at__date', 'topics__name', 'legislator_id', 'legislator__party'):
        date = post['created_at__date']
        topic = post['topics__name']
        party = post['legislator__party']
        if date in response_data and topic in response_data[date] and party in response_data[date][topic]:
            response_data[date][topic][party]['legislators'].add(post['legislator_id'])

    # Convert sets to counts
    for date in response_data:
        for topic in response_data[date]:
            for party in response_data[date][topic]:
                response_data[date][topic][party]['legislators'] = len(response_data[date][topic][party]['legislators'])

    # Convert response_data to a list of dictionaries
    print("Converting response data to list format...")
    response_list = [{'date': date, **topics} for date, topics in response_data.items()]
    print(f"Final response contains {len(response_list)} records")

    print("Returning bipartite flow data")
    return JsonResponse(response_list, safe=False)

# 🔹 Testing/Debug APIs
def topic_post_counts(request):
    # Get all topics and count their associated posts
    topic_counts = Topic.objects.values('name').annotate(
        post_count=Count('post')
    ).order_by('-post_count')  # Orders by count descending
    
    # Format the results
    results = {
        'total_topics': Topic.objects.count(),
        'total_posts': Post.objects.count(),
        'topic_counts': list(topic_counts)
    }
    
    return JsonResponse(results, safe=False)

def post_statistics(request):
    # Step 1: Get all relevant topics and parties from existing posts
    topic_names = Topic.objects.exclude(name__isnull=True).values_list('name', flat=True).distinct()
    party_values = Post.objects.exclude(party__isnull=True).values_list('party', flat=True).distinct()

    # Step 2: Build the full date range
    start_date = date(2020, 1, 1)
    end_date = date(2021, 12, 31)
    all_dates = []
    current = start_date
    while current <= end_date:
        all_dates.append(current.strftime('%Y-%m-%d'))
        current += timedelta(days=1)

    # Step 3: Fetch post stats (only actual data)
    posts = (
        Post.objects
        .filter(topics__isnull=False)
        .annotate(date=TruncDate('created_at'))
        .values('date', 'party', 'topics__name')
        .annotate(
            avg_misinfo=Avg('count_misinfo'),
            avg_civility=Avg('civility_score'),
        )
    )

    # Step 4: Restructure aggregated data
    data_map = {}
    for entry in posts:
        key = (
            entry['date'].strftime('%Y-%m-%d'),
            entry['party'],
            entry['topics__name']
        )
        avg_misinfo = -entry['avg_misinfo'] if entry['party'] in ['R', 'Republican'] else entry['avg_misinfo']
        data_map[key] = {
            'avg_misinfo': avg_misinfo,
            'avg_civility': entry['avg_civility'],
        }

    # Step 5: Build full response with empty defaults where needed
    response_data = {}
    for day in all_dates:
        response_data[day] = {}
        for party in party_values:
            response_data[day][party] = {}
            all_metrics = {'avg_misinfo': 0, 'avg_civility': 0}
            topic_count = 0
            for topic in topic_names:
                key = (day, party, topic)
                if key in data_map:
                    response_data[day][party][topic] = data_map[key]
                    all_metrics['avg_misinfo'] += data_map[key]['avg_misinfo']
                    all_metrics['avg_civility'] += data_map[key]['avg_civility']
                    topic_count += 1
                else:
                    response_data[day][party][topic] = {
                        'avg_misinfo': 0,
                        'avg_civility': 0,
                    }
            # Calculate averages for the "all" topic
            if topic_count > 0:
                response_data[day][party]['all'] = {
                    'avg_misinfo': all_metrics['avg_misinfo'] / topic_count,
                    'avg_civility': all_metrics['avg_civility'] / topic_count,
                }
            else:
                response_data[day][party]['all'] = {
                    'avg_misinfo': 0,
                    'avg_civility': 0,
                }

    return JsonResponse(response_data, safe=False)

def overview_metrics(request):
    """
    Endpoint providing overview metrics and visualization data for dashboard
    
    Parameters:
    - start_date: ISO format date string (e.g., "2020-01-01")
    - end_date: ISO format date string (e.g., "2021-12-31")
    - topics: Comma-separated list of topic names
    
    Returns structured JSON with summary metrics and visualization data
    """
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topics_param = request.GET.get('topics', '')
    
    # Parse topics from comma-separated string to list if provided
    topics = [topic.strip() for topic in topics_param.split(',')] if topics_param else []
    
    # Build filter conditions
    filters = Q()
    if start_date and end_date:
        start_date_obj = parse_date(start_date)
        end_date_obj = parse_date(end_date)
        filters &= Q(created_at__range=[start_date_obj, end_date_obj])
    
    # Add topic filtering if topics are provided
    if topics:
        filters &= Q(topics__name__in=topics)
    
    # Get filtered posts
    filtered_posts = Post.objects.filter(filters).select_related('legislator').distinct()
    
    # Calculate summary metrics by party
    summary_metrics = filtered_posts.values('party').annotate(
        total_posts=Count('post_id'),
        avg_interaction_score=Avg('interaction_score'),
        total_likes=Sum('like_count'),
        total_retweets=Sum('retweet_count')
    ).order_by('party')
    
    # Structure as dictionary keyed by party
    summary_metrics_dict = {}
    for item in summary_metrics:
        if item['party'] in ['Democratic', 'Republican']:
            summary_metrics_dict[item['party']] = {
                "totalPosts": item['total_posts'],
                "avgInteractionScore": item['avg_interaction_score'],
                "totalLikes": item['total_likes'],
                "totalRetweets": item['total_retweets']
            }
    
    # Bar chart data (posts, likes, retweets by party)
    bar_chart_party_summary = [
        {
            "party": item['party'],
            "totalPosts": item['total_posts'],
            "likes": item['total_likes'],
            "retweets": item['total_retweets']
        }
        for item in summary_metrics if item['party'] in ['Democratic', 'Republican']
    ]
    
    # Radar chart metrics (avg. civility, misinfo, interaction per party)
    radar_chart_metrics = filtered_posts.values('party').annotate(
        avg_civility_score=Avg('civility_score'),
        avg_misinfo_score=Avg('count_misinfo'),
        avg_interaction_score=Avg('interaction_score')
    ).filter(party__in=['Democratic', 'Republican'])
    
    radar_chart_metrics_list = [
        {
            "party": item['party'],
            "avgCivilityScore": item['avg_civility_score'],
            "avgMisinfoScore": item['avg_misinfo_score'],
            "avgInteractionScore": item['avg_interaction_score']
        } for item in radar_chart_metrics
    ]
    
    # Compile the final response
    response_data = {
        "summaryMetrics": summary_metrics_dict,
        "visualizations": {
            "barChartPartySummary": bar_chart_party_summary,
            "radarChartMetrics": radar_chart_metrics_list
        }
    }
    
    return JsonResponse(response_data)

def bipartite_data(request):
    file_path = os.path.join(settings.BASE_DIR, 'static', 'data', 'defaultBipartite.json')
    
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def accountability_data(request):
    file_path = os.path.join(settings.BASE_DIR, 'static', 'data', 'defaultAccountability.json')
    
    try:
        with open(file_path, 'r') as f:
            raw_data = json.load(f)
        return JsonResponse(raw_data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def trend_data(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topics_param = request.GET.get('topics', '')
    
    topics = [topic.strip() for topic in topics_param.split(',')] if topics_param else []
    
    filters = Q()
    if start_date and end_date:
        start_date_obj = parse_date(start_date)
        end_date_obj = parse_date(end_date)
        filters &= Q(created_at__range=[start_date_obj, end_date_obj])
    
    if topics:
        filters &= Q(topics__name__in=topics)
    
    filtered_posts = Post.objects.filter(filters).select_related('legislator').distinct()
    
    # Determine binning by week or day
    date_diff = (end_date_obj - start_date_obj).days
    if date_diff > 365:
        date_trunc = TruncWeek('created_at')
    else:
        date_trunc = TruncDay('created_at')
    
    trend_data = filtered_posts.annotate(date=date_trunc).values('date', 'party').annotate(
        total_posts=Count('post_id'),
        avg_interaction_score=Avg('interaction_score'),
        total_likes=Sum('like_count'),
        total_retweets=Sum('retweet_count')
    ).order_by('date', 'party')
    
    trend_data_dict = {}
    for item in trend_data:
        date_str = item['date'].strftime('%Y-%m-%d')
        if date_str not in trend_data_dict:
            trend_data_dict[date_str] = {}
        trend_data_dict[date_str][item['party']] = {
            "totalPosts": item['total_posts'],
            "avgInteractionScore": item['avg_interaction_score'],
            "totalLikes": item['total_likes'],
            "totalRetweets": item['total_retweets']
        }
    
    return JsonResponse(trend_data_dict, safe=False)

def engagement_metrics(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topics_param = request.GET.get('topics', '')

    topics = [topic.strip() for topic in topics_param.split(',')] if topics_param else []

    filters = Q()
    if start_date and end_date:
        start_date_obj = parse_date(start_date)
        end_date_obj = parse_date(end_date)
        filters &= Q(created_at__range=[start_date_obj, end_date_obj])

    if topics:
        filters &= Q(topics__name__in=topics)

    filtered_posts = Post.objects.filter(filters).select_related('legislator').distinct()

    # Calculate engagement metrics
    engagement_data = filtered_posts.values('party', 'topics__name').annotate(
        total_engagement=Sum('like_count') + Sum('retweet_count'),
        total_likes=Sum('like_count'),
        total_retweets=Sum('retweet_count')
    ).order_by('party', 'topics__name')

    # Structure the response
    response_data = {
        "total_engagement": filtered_posts.aggregate(total=Sum('like_count') + Sum('retweet_count'))['total'],
        "by_party": {}
    }

    for item in engagement_data:
        party = item['party']
        topic = item['topics__name']
        topic_with_party = f"{topic} ({'D' if party == 'Democratic' else 'R'})"
        if party not in response_data['by_party']:
            response_data['by_party'][party] = {
                "total_engagement": 0,
                "topics": {}
            }
        response_data['by_party'][party]['total_engagement'] += item['total_engagement']
        response_data['by_party'][party]['topics'][topic_with_party] = {
            "engagement": item['total_engagement'],
            "likes": item['total_likes'],
            "retweets": item['total_retweets']
        }

    return JsonResponse(response_data)

def default_engagement_data(request):
    # Path to the JSON file
    json_file_path = os.path.join(os.path.dirname(__file__), '../static/data/defaultEngagementTab.json')
    
    try:
        with open(json_file_path, 'r') as json_file:
            data = json.load(json_file)
        return JsonResponse(data, safe=False)
    except FileNotFoundError:
        return HttpResponse(status=404, content="Default engagement data not found.")

def default_overview_data(request):
    # Path to the JSON file
    json_file_path = os.path.join(os.path.dirname(__file__), '../static/data/defaultOverviewTab.json')
    
    try:
        with open(json_file_path, 'r') as json_file:
            data = json.load(json_file)
        return JsonResponse(data, safe=False)
    except FileNotFoundError:
        return HttpResponse(status=404, content="Default overview data not found.")