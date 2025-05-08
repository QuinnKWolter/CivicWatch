import numpy as np 
import pandas as pd
from django.core.management.base import BaseCommand
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
from civicwatch.models import Post
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

MODEL_NAME = 'all-MiniLM-L6-v2'
BATCH_SIZE = 64

class Command(BaseCommand):
    help = 'Generates sentence embeddings and PCA coordinates for tweets'

    def handle(self, *args, **options):
        logging.info("Starting tweet processing")

        posts_to_process = Post.objects.filter(pca_x__isnull=True)
        post_text = [post.text for post in posts_to_process]
        post_ids = [post.post_id for post in posts_to_process]

        if not post_text:
            logging.info("No new tweets to process")
            return

        logging.info(f"Found {len(post_text)} tweets to process.")

        model = SentenceTransformer(MODEL_NAME)

        embeddings = model.encode(post_text, show_progress_bar=True, batch_size=BATCH_SIZE)
        logging.info(f"Generated {embeddings.shape[0]} embeddings with dimension {embeddings.shape[1]}.")

        logging.info("Applying PCA...")
        pca = PCA(n_components=2)
        pca_results = pca.fit_transform(embeddings)
        logging.info("PCA transformation complete.")

        logging.info("Updating database...")

        updates = []

        for i, post_id in enumerate(post_ids):
            post = posts_to_process[i]
            post.pca_x = pca_results[i, 0]
            post.pca_y = pca_results[i, 1]
            updates.append(post)
        
        if updates:
            Post.objects.bulk_update(updates, ['pca_x', 'pca_y'])
            logging.info(f"Updated batch of{len(updates)} posts")

        logging.info("finito")