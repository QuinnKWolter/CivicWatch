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

    # New Overview Metrics Endpoint
    path("api/overview_metrics/", views.overview_metrics, name="overview_metrics"),

    # New endpoints for bipartite flow and accountability data
    path("api/flow/bipartite_data/", views.bipartite_data, name="bipartite_data"),
    path("api/flow/accountability_data/", views.accountability_data, name="accountability_data"),

    # Bipartite Temporal Flow Diagram APIs
    path("api/flow/bipartite/", views.bipartite_flow_data, name="bipartite_flow_data"),

    path("api/legislators/scatter/", views.legislators_scatter_data, name="legislators_scatter"),
    path("api/legislator_posts/", views.legislator_posts_line_chart, name="legislator_posts"),
    path('api/test/topic-counts/', views.topic_post_counts, name='topic_post_counts'),
    path("api/posts/statistics/", views.post_statistics, name="post_statistics"),
    path('api/trend_data/', views.trend_data, name='trend_data'),
]
