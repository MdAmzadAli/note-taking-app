import numpy as np
import regex as re
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import statistics
import hdbscan
from collections import deque, defaultdict
import matplotlib.pyplot as plt
import matplotlib.patches as patches
def _plot_hdbscan_clusters(elements: List[Dict[str, Any]], labels: np.ndarray, page_num: int, page_width: float, page_height: float):
  """Plot HDBSCAN clusters to visualize layout detection"""
  try:
      # Create figure
      fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 10))

      # Extract positions
      x_positions = [elem["bbox"][0] for elem in elements]
      y_positions = [elem["bbox"][1] for elem in elements]

      # Flip Y coordinates for proper visualization (PDF origin is bottom-left)
      y_positions_flipped = [page_height - y for y in y_positions]

      # Plot 1: X-position clustering (1D)
      unique_labels = set(labels)
      colors = plt.cm.Set1(np.linspace(0, 1, len(unique_labels)))

      ax1.set_title(f'Page {page_num}: HDBSCAN X-Position Clustering')
      ax1.set_xlabel('X Position')
      ax1.set_ylabel('Count')

      for label, color in zip(unique_labels, colors):
          if label == -1:
              color = 'black'  # Noise points
              marker = 'x'
              alpha = 0.5
              label_name = 'Noise'
          else:
              marker = 'o'
              alpha = 0.8
              label_name = f'Cluster {label}'

          mask = labels == label
          cluster_x = np.array(x_positions)[mask]
          cluster_y = np.random.normal(0, 5, len(cluster_x))  # Add jitter for visibility

          ax1.scatter(cluster_x, cluster_y, c=[color], marker=marker, alpha=alpha, 
                     s=50, label=f'{label_name} ({len(cluster_x)})')

      ax1.set_xlim(0, page_width)
      ax1.legend()
      ax1.grid(True, alpha=0.3)

      # Plot 2: 2D layout visualization
      ax2.set_title(f'Page {page_num}: Elements Layout with Clusters')
      ax2.set_xlabel('X Position')
      ax2.set_ylabel('Y Position (flipped)')

      for label, color in zip(unique_labels, colors):
          if label == -1:
              color = 'black'
              marker = 'x'
              alpha = 0.5
              size = 30
              label_name = 'Noise'
          else:
              marker = 'o'
              alpha = 0.8
              size = 60
              label_name = f'Cluster {label}'

          mask = labels == label
          cluster_x = np.array(x_positions)[mask]
          cluster_y = np.array(y_positions_flipped)[mask]

          ax2.scatter(cluster_x, cluster_y, c=[color], marker=marker, alpha=alpha, 
                     s=size, label=f'{label_name} ({len(cluster_x)})')

      # Draw bounding boxes for elements
      for i, elem in enumerate(elements):
          bbox = elem["bbox"]
          x0, y0, x1, y1 = bbox[0], page_height - bbox[3], bbox[2], page_height - bbox[1]

          # Color code by cluster
          label = labels[i]
          if label == -1:
              edge_color = 'black'
              alpha = 0.3
          else:
              edge_color = colors[list(unique_labels).index(label)]
              alpha = 0.5

          rect = patches.Rectangle((x0, y0), x1-x0, y1-y0, 
                                 linewidth=1, edgecolor=edge_color, 
                                 facecolor='none', alpha=alpha)
          ax2.add_patch(rect)

      ax2.set_xlim(0, page_width)
      ax2.set_ylim(0, page_height)
      ax2.legend()
      ax2.grid(True, alpha=0.3)

      # Save plot
      plot_filename = f"hdbscan_clusters_page_{page_num}.png"
      plt.tight_layout()
      plt.savefig(plot_filename, dpi=150, bbox_inches='tight')
      print(f"  📊 Cluster plot saved: {plot_filename}")

      # Show cluster statistics
      print(f"  📊 Cluster Statistics:")
      for label in unique_labels:
          count = np.sum(labels == label)
          if label == -1:
              print(f"    Noise: {count} elements")
          else:
              cluster_x = np.array(x_positions)[labels == label]
              x_range = f"{min(cluster_x):.1f}-{max(cluster_x):.1f}"
              print(f"    Cluster {label}: {count} elements (X: {x_range})")

      plt.close()  # Close to free memory

  except Exception as e:
      print(f"  ⚠️ Error plotting clusters: {e}")
