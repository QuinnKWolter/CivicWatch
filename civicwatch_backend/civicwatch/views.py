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
    try:
        print("Fetching legislators")
        legislators = Legislator.objects.values("legislator_id", "name", "state", "party").order_by("state", "name")
        print("Legislators fetched:", legislators)
        return JsonResponse(list(legislators), safe=False)
    except Exception as e:
        print("Error fetching legislators:", e)
        return JsonResponse({"error": str(e)}, status=500)

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

from django.http import JsonResponse
from django.db.models import Count
from django.db.models.functions import TruncMonth
# Ensure your models are imported
from .models import Post, Legislator

def legislator_posts_by_month_top_50(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    specific_legislator_id = request.GET.get('legislator_id')
    limit_per_party = 50

   
    posts_query = Post.objects.select_related('legislator').all() 

    
    date_filters = {}
    if start_date:
        date_filters['created_at__gte'] = start_date
    if end_date:
        date_filters['created_at__lte'] = end_date

    
    if date_filters:
        posts_query = posts_query.filter(**date_filters)

  
    if specific_legislator_id:
       
        monthly_data = (
            posts_query
            .filter(legislator_id=specific_legislator_id) 
            .annotate(month=TruncMonth('created_at'))
            
            .values('legislator_id', 'legislator__name', 'month', 'legislator__party')
           
            .annotate(post_count=Count('post_id'))
            .order_by('legislator__name', 'month') 
        )
        legislator_ids_to_include = {int(specific_legislator_id)}

    else:
     
        legislator_totals = (
            posts_query 
            
            .values('legislator_id', 'legislator__name', 'legislator__party')
            
            .annotate(total_post_count=Count('post_id'))
            
            .order_by('legislator__party', '-total_post_count')
        )

       
        legislator_ids_to_include = set()
        party_counts = {}

        for legislator in legislator_totals:
            
            party = legislator['legislator__party']
            current_party_count = party_counts.get(party, 0)

            if current_party_count < limit_per_party:
              
                legislator_ids_to_include.add(legislator['legislator_id'])
                party_counts[party] = current_party_count + 1

        if not legislator_ids_to_include:
            return JsonResponse({'legislators': []})

        
        monthly_data = (
            posts_query
            .filter(legislator_id__in=legislator_ids_to_include) 
            .annotate(month=TruncMonth('created_at'))
             
            .values('legislator_id', 'legislator__name', 'month', 'legislator__party')
           
            .annotate(post_count=Count('post_id'))
            .order_by('legislator__name', 'month') 
        )

    
    result = {}

   
    if not specific_legislator_id and legislator_ids_to_include:
        
        legislator_details = Legislator.objects.filter(legislator_id__in=legislator_ids_to_include)\
                                             .values('legislator_id', 'name', 'party') 
        for leg in legislator_details:
            l_id = leg['legislator_id']
            if l_id not in result:
                 result[l_id] = {
                    'legislator_id': l_id,
                    'name': leg['name'],        
                    'monthly_post_counts': {},
                    'party': leg['party']        
                 }

   
    for entry in monthly_data:
       
        l_id = entry['legislator_id']
        name = entry['legislator__name']
        month_obj = entry['month']
        count = entry['post_count']
        party = entry['legislator__party'] 

        
        if l_id not in result:
            result[l_id] = {
                'legislator_id': l_id,
                'name': name,
                'monthly_post_counts': {},
                'party': party
            }

       
        if month_obj:
            month_str = month_obj.strftime('%Y-%m')
            result[l_id]['monthly_post_counts'][month_str] = count

    return JsonResponse({'legislators': list(result.values())})




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

# def geo_activity_topics(request):
#     start_date = request.GET.get('start_date')
#     end_date = request.GET.get('end_date')
#     metric = request.GET.get('metric', 'posts')

#     topics_param = request.GET.get('topics', '')
#     topic_list = [topic.strip() for topic in topics_param.split(',')] if topics_param else []

#     # Define the default conditions
#     default_start_date = '2020-01-01'
#     default_end_date = '2021-12-31'
#     default_topics = ['abortion', 'blacklivesmatter', 'capitol', 'climate', 'covid', 'gun', 'immigra', 'rights']

#     # Check if the request matches the default conditions
#     if (start_date == default_start_date and end_date == default_end_date and
#         set(topic_list) == set(default_topics)):

#         # Determine which default file to serve based on the metric
#         if metric == 'posts':
#             file_path = os.path.join(settings.BASE_DIR, 'static', 'data', 'defaultChoroplethPosts.json')
#         elif metric == 'legislators':
#             file_path = os.path.join(settings.BASE_DIR, 'static', 'data', 'defaultChoroplethLegislators.json')
#         elif metric == 'engagement':
#             file_path = os.path.join(settings.BASE_DIR, 'static', 'data', 'defaultChoroplethEngagement.json')
#         else:
#             return JsonResponse({"error": "Invalid metric"}, status=400)

#         try:
#             with open(file_path, 'r') as f:
#                 data = json.load(f)
#             return JsonResponse(data, safe=False)
#         except FileNotFoundError:
#             return JsonResponse({"error": "Default data file not found"}, status=404)

#     # If not default, proceed with the regular logic
#     posts = Post.objects.all()

#     if start_date:
#         posts = posts.filter(created_at__gte=start_date)
#     if end_date:
#         posts = posts.filter(created_at__lte=end_date)

#     if topic_list:
#         posts = posts.filter(topics__name__in=topic_list).distinct()

#     geo_stats = []

#     if metric == 'posts':
#         post_counts = posts.values('state', 'party').annotate(total=Count('post_id'))
#         geo_stats = list(post_counts)

#     elif metric == 'legislators':
#         legislator_counts = posts.values('state', 'party', 'legislator_id').distinct().annotate(
#             legislator_count=Count('legislator_id', distinct=True)
#         )
#         geo_stats = list(legislator_counts)

#     elif metric == 'engagement':
#         unique_post_ids = posts.values_list('post_id', flat=True).distinct()
#         filtered_posts = Post.objects.filter(post_id__in=unique_post_ids)

#         engagement_data = filtered_posts.values('state', 'party').annotate(
#             total_engagement=Sum(F('like_count') + F('retweet_count'))
#         )
#         geo_stats = list(engagement_data)

#     state_party_data = {}
#     for entry in geo_stats:
#         state = entry['state']
#         party = entry['party']

#         if party not in ['Democratic', 'Republican']:
#             continue

#         total = (
#             entry['total'] if metric == 'posts'
#             else entry['legislator_count'] if metric == 'legislators'
#             else entry['total_engagement']
#         )

#         if state not in state_party_data:
#             state_party_data[state] = {
#                 'state': state,
#                 'Democratic': 0,
#                 'Republican': 0,
#                 'total': 0
#             }

#         state_party_data[state][party] += total
#         state_party_data[state]['total'] += total

#     return JsonResponse(list(state_party_data.values()), safe=False)

def geo_activity_topics(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    metric = request.GET.get('metric', 'posts')

    topics_param = request.GET.get('topics', '')
    topic_list = [topic.strip() for topic in topics_param.split(',')] if topics_param else []

    default_start_date = '2020-01-01'
    default_end_date = '2021-12-31'
    default_topics = ['abortion', 'blacklivesmatter', 'capitol', 'climate', 'covid', 'gun', 'immigra', 'rights']

    
    posts = Post.objects.all()

    if start_date:
        posts = posts.filter(created_at__gte=start_date)
    if end_date:
        posts = posts.filter(created_at__lte=end_date)

    if topic_list:
        posts = posts.filter(topics__name__in=topic_list).distinct()

    state_party_data = {}

    if metric == 'posts':
        base_data = posts.values('state', 'party').annotate(total=Count('post_id'))
        topic_data = posts.values('state', 'party', 'topics__name').annotate(total=Count('post_id'))

    elif metric == 'legislators':
        # Base: get unique legislators per (state, party)
        base_legislators = posts.values('state', 'party', 'legislator_id').distinct()
        base_data_dict = {}
        for entry in base_legislators:
            key = (entry['state'], entry['party'])
            base_data_dict.setdefault(key, set()).add(entry['legislator_id'])

        base_data = []
        for (state, party), legislators in base_data_dict.items():
            base_data.append({
                'state': state,
                'party': party,
                'total': len(legislators)
            })

        # Topic-wise unique legislators
        topic_legislators = posts.values('state', 'party', 'topics__name', 'legislator_id').distinct()
        topic_data_dict = {}
        for entry in topic_legislators:
            key = (entry['state'], entry['party'], entry['topics__name'])
            topic_data_dict.setdefault(key, set()).add(entry['legislator_id'])

        topic_data = []
        for (state, party, topic), legislators in topic_data_dict.items():
            topic_data.append({
                'state': state,
                'party': party,
                'topics__name': topic,
                'total': len(legislators)
            })

    elif metric == 'engagement':
        filtered_posts = posts

        base_data = filtered_posts.values('state', 'party').annotate(
            total=Sum(F('like_count') + F('retweet_count'))
        )
        topic_data = filtered_posts.values('state', 'party', 'topics__name').annotate(
            total=Sum(F('like_count') + F('retweet_count'))
        )

    else:
        return JsonResponse({"error": "Unsupported metric"}, status=400)

    # Base aggregation population
    for entry in base_data:
        state = entry['state']
        party = entry['party']
        total = entry['total']

        if party not in ['Democratic', 'Republican']:
            continue

        if state not in state_party_data:
            state_party_data[state] = {
                'state': state,
                'Democratic': 0,
                'Republican': 0,
                'total': 0,
                'topic_breakdown': {},
                'legislator_breakdown': {}
            }

        state_party_data[state][party] += total
        state_party_data[state]['total'] += total

    # Topic-wise aggregation
    for entry in topic_data:
        state = entry['state']
        party = entry['party']
        topic = entry.get('topics__name')
        total = entry['total']

        if not state or not topic or party not in ['Democratic', 'Republican']:
            continue

        if state not in state_party_data:
            state_party_data[state] = {
                'state': state,
                'Democratic': 0,
                'Republican': 0,
                'total': 0,
                'topic_breakdown': {},
                'legislator_breakdown': {}
            }

        if topic not in state_party_data[state]['topic_breakdown']:
            state_party_data[state]['topic_breakdown'][topic] = {
                'Democratic': 0,
                'Republican': 0,
                'total': 0
            }

        state_party_data[state]['topic_breakdown'][topic][party] += total
        state_party_data[state]['topic_breakdown'][topic]['total'] += total

        if topic not in state_party_data[state]['legislator_breakdown']:
            state_party_data[state]['legislator_breakdown'][topic] = {
                'Democratic': 0,
                'Republican': 0,
                'total': 0
            }

        state_party_data[state]['legislator_breakdown'][topic][party] += total
        state_party_data[state]['legislator_breakdown'][topic]['total'] += total

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
    
    # Build filter conditions for Posts
    filters = Q()
    if start_date and end_date:
        start_date_obj = parse_date(start_date)
        end_date_obj = parse_date(end_date)
        filters &= Q(created_at__range=[start_date_obj, end_date_obj])
    
    # Add topic filtering if topics are provided
    if topics:
        filters &= Q(topics__name__in=topics)
    
    # Get filtered posts (using select_related to fetch legislator data efficiently)
    filtered_posts = Post.objects.filter(filters).select_related('legislator').distinct()
    
    # Calculate basic summary metrics by party
    summary_metrics = filtered_posts.values('party').annotate(
        total_posts=Count('post_id'),
        avg_interaction_score=Avg('interaction_score'),
        total_likes=Sum('like_count'),
        total_retweets=Sum('retweet_count')
    ).order_by('party')
    
    # Structure basic summary metrics in a dictionary keyed by party
    summary_metrics_dict = {}
    for item in summary_metrics:
        if item['party'] in ['Democratic', 'Republican']:
            summary_metrics_dict[item['party']] = {
                "totalPosts": item['total_posts'],
                "avgInteractionScore": item['avg_interaction_score'],
                "totalLikes": item['total_likes'],
                "totalRetweets": item['total_retweets']
            }
    
    # Compute extended metrics for each party
    for party in ['Democratic', 'Republican']:
        # Filter posts further by party
        party_posts = filtered_posts.filter(party=party)
        
        # 1. Number of Legislators: distinct legislator_id
        num_legislators = party_posts.values('legislator__legislator_id').distinct().count()
        
        # 2. Number of Uncivil Posts: assume uncivil if civility_score < 1 (adjust threshold if needed)
        num_uncivil_posts = party_posts.filter(civility_score__lt=1).count()
        
        # 3. Number of Misinformative Posts: assume misinformative if count_misinfo > 0
        num_misinfo_posts = party_posts.filter(count_misinfo__gt=0).count()
        
        # 4. Most Active State: group by state, then pick the one with the largest post count
        most_active_state_obj = party_posts.values('state').annotate(post_count=Count('post_id')).order_by('-post_count').first()
        most_active_state = most_active_state_obj['state'] if most_active_state_obj else None
        
        # Add these to the summary for the party
        if party in summary_metrics_dict:
            summary_metrics_dict[party].update({
                "numberLegislators": num_legislators,
                "numUncivilPosts": num_uncivil_posts,
                "numMisinfoPosts": num_misinfo_posts,
                "mostActiveState": most_active_state
            })
        else:
            # In case there are no posts for a given party, add default values
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
    
    # Compile the final response data
    response_data = {
        "summaryMetrics": summary_metrics_dict,
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

def accountability_interface(request):
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    topics_param = request.GET.get('topics', '')
    topic_list = [topic.strip() for topic in topics_param.split(',')] if topics_param else []

    posts = Post.objects.all()

    if start_date:
        posts = posts.filter(created_at__gte=start_date)
    if end_date:
        posts = posts.filter(created_at__lte=end_date)
    if topic_list:
        posts = posts.filter(topics__name__in=topic_list).distinct()

    # Group by party and calculate counts
    party_data = posts.values('party').annotate(
        civil_count=Count('post_id', filter=Q(civility_score=1)),
        uncivil_count=Count('post_id', filter=~Q(civility_score=1)),
        misinformative_count=Count('post_id', filter=~Q(count_misinfo=0)),
        informative_count=Count('post_id', filter=Q(count_misinfo=0))
    )

    # Prepare data for response
    data = {
        'by_party': {}
    }

    for entry in party_data:
        party = entry['party']
        total_civil_uncivil = entry['civil_count'] + entry['uncivil_count']
        total_informative_misinformative = entry['informative_count'] + entry['misinformative_count']

        data['by_party'][party] = {
            'civil_vs_uncivil': f"{entry['civil_count']}/{total_civil_uncivil}",
            'informative_vs_misinformative': f"{entry['informative_count']}/{total_informative_misinformative}"
        }

    return JsonResponse(data)

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
        avg_engagement_per_post=Case(
            When(total_posts=0, then=0),
            default=(Sum('like_count') + Sum('retweet_count')) / Count('post_id'),
            output_field=IntegerField()
        )
    ).order_by('date', 'party')
    
    trend_data_dict = {}
    for item in trend_data:
        date_str = item['date'].strftime('%Y-%m-%d')
        if date_str not in trend_data_dict:
            trend_data_dict[date_str] = {}
        trend_data_dict[date_str][item['party']] = {
            "avgEngagementPerPost": item['avg_engagement_per_post']
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

def default_trendline_data(request):
    # Path to the JSON file
    json_file_path = os.path.join(os.path.dirname(__file__), '../static/data/defaultOverviewTrendline.json')
    
    try:
        with open(json_file_path, 'r') as json_file:
            data = json.load(json_file)
        return JsonResponse(data, safe=False)
    except FileNotFoundError:
        return HttpResponse(status=404, content="Default trendline data not found.")