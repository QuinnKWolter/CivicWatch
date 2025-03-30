from django.shortcuts import render

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum, Avg, Q
from .models import Legislator, Post, LegislatorInteraction, Topic
from datetime import datetime

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
