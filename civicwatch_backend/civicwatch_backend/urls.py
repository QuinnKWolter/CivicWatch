"""
URL configuration for civicwatch_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from civicwatch import views

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # General Data Retrieval
    path("api/legislators/", views.all_legislators, name="all_legislators"),
    path("api/legislator/<str:legislator_id>/", views.legislator_detail, name="legislator_detail"),
    path("api/topics/", views.all_topics, name="all_topics"),

    # New Overview Metrics Endpoint
    path("api/overview_metrics/", views.overview_metrics, name="overview_metrics"),

    # New endpoints for bipartite flow and accountability data
    path("api/flow/bipartite_data/", views.bipartite_data, name="bipartite_data"),
    path("api/flow/accountability_data/", views.accountability_data, name="accountability_data"),

    # Bipartite Temporal Flow Diagram APIs
    path("api/flow/posts/", views.flow_posts, name="flow_posts"),
    path("api/flow/posts/stats/", views.flow_civility_misinformation, name="flow_civility_misinformation"),
    path("api/flow/engagement/", views.flow_engagement, name="flow_engagement"),
    path("api/flow/legislators/", views.flow_posts, name="flow_legislators"),
    path("api/flow/bipartite/", views.bipartite_flow_data, name="bipartite_flow_data"),

    # Chord Diagram APIs (Legislator Interactions)
    path("api/chord/interactions/", views.chord_interactions, name="chord_interactions"),
    path("api/chord/network/", views.chord_interactions, name="chord_network"),
    path("api/chord/top_legislators/", views.chord_top_legislators, name="chord_top_legislators"),

    # Geographic Data APIs
    path("api/geo/activity/", views.geo_activity, name="geo_activity"),

    # Post Exploration APIs
    path("api/posts/", views.all_posts, name="all_posts"),
    path("api/posts/top/", views.top_posts, name="top_posts"),

    path("api/legislators/scatter/", views.legislators_scatter_data, name="legislators_scatter"),
    path("api/legislator_posts/", views.legislator_posts_line_chart, name="legislator_posts"),
    path('api/test/topic-counts/', views.topic_post_counts, name='topic_post_counts'),
    path("api/posts/statistics/", views.post_statistics, name="post_statistics"),
    path('api/trend_data/', views.trend_data, name='trend_data'),
]
