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
from civicwatch import views_clean as views

urlpatterns = [
    path("admin/", admin.site.urls),

    # Minimal API surface kept for the current prototype use
    # CSV Export (Navbar)
    path("api/export-posts-csv/", views.export_posts_csv, name="export_posts_csv"),

    # Sidebar
    path("api/legislators/", views.all_legislators, name="all_legislators"),

    # EngagementTimeline
    path("api/flow/bipartite_data/", views.bipartite_data, name="bipartite_data"),

    # ContextPanel (TimelineContext)
    path("api/default_overview_data/", views.default_overview_data, name="default_overview_data"),
    path("api/overview_metrics/", views.overview_metrics, name="overview_metrics"),
]
