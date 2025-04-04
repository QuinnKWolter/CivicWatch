from django.shortcuts import render

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum, Avg, Q
from .models import Legislator, Post, LegislatorInteraction, Topic
from datetime import datetime, timedelta, date
from django.utils.dateparse import parse_date

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

    posts = Post.objects.filter(post_filter).values(
        "post_id", "legislator_id", "name", "created_at", "text",
        "attachment", "state", "chamber", "party",
        "retweet_count", "like_count", "count_misinfo",
        "interaction_score", "overperforming_score", "civility_score"
    ).order_by("created_at")

    response_data = [
        {
            "id": post["post_id"],
            "lid": post["legislator_id"],
            "name": post["name"],
            "handle": legislator.name.replace(" ", ""),
            "created_at": post["created_at"],
            "text": post["text"],
            "attachment": post["attachment"],
            "state": post["state"],
            "chamber": post["chamber"],
            "party": post["party"],
            "retweet_count": post["retweet_count"],
            "like_count": post["like_count"],
            "count_misinfo": post["count_misinfo"],
            "interaction_score": post["interaction_score"],
            "overperforming_score": post["overperforming_score"],
            "civility_score": post["civility_score"],
        }
        for post in posts
    ]

    return JsonResponse(response_data, safe=False)

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

# 🔹 Post Exploration APIs
def all_posts(request):
    posts = filter_posts(request)
    post_list = posts.values("post_id", "text", "created_at", "like_count", "retweet_count", "civility_score", "count_misinfo")
    return JsonResponse(list(post_list), safe=False)

def top_posts(request):
    posts = filter_posts(request).order_by("-like_count")[:10]
    post_list = posts.values("post_id", "text", "like_count", "retweet_count")
    return JsonResponse(list(post_list), safe=False)

def legislators_scatter_data(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    legislators = Legislator.objects.all()

    topic_keywords = ["abortion", "blacklivesmatter", "capitol", "climate", "covid", "gun", "immigra", "rights"]

    posts_filter = Q()
    if start_date:
        start_date = parse_date(start_date)
        posts_filter &= Q(created_at__gte=start_date)
    if end_date:
        end_date = parse_date(end_date)
        posts_filter &= Q(created_at__lte=end_date)

    data = []
    for legislator in legislators:
        posts = legislator.tweets.filter(posts_filter)

        topic_counts = {topic: posts.filter(text__icontains=topic).count() for topic in topic_keywords}

        data.append({
            "name": legislator.name,
            "state": legislator.state,
            "chamber": legislator.chamber,
            "party": legislator.party,
            "lid": legislator.legislator_id,
            "total_posts_tw": posts.count(),
            "total_likes_tw": posts.aggregate(total_likes=Sum("like_count"))["total_likes"] or 0,
            "total_retweets_tw": posts.aggregate(total_retweets=Sum("retweet_count"))["total_retweets"] or 0,
            "total_misinfo_count_tw": posts.aggregate(total_misinfo=Sum("count_misinfo"))["total_misinfo"] or 0,
            "total_interactions_tw": posts.aggregate(total_interactions=Sum("like_count") + Sum("retweet_count"))["total_interactions"] or 0,
            "interaction_score_tw": legislator.interaction_score_tw,
            "overperforming_score_tw": legislator.overperforming_score_tw,
            "civility_score_tw": legislator.civility_score_tw,
            **topic_counts  # Add topic data dynamically
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
    empty_date = "2020-01-01"
    response_data[empty_date] = {}
    for topic in ['abortion', 'blacklivesmatter', 'climate', 'gun', 'immigra', 'rights']:
        response_data[empty_date][topic] = {
            'D': {'posts': 0, 'legislators': set(), 'likes': 0, 'shares': 0},
            'R': {'posts': 0, 'legislators': set(), 'likes': 0, 'shares': 0}
        }
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