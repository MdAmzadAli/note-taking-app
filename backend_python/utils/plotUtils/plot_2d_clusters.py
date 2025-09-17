import numpy as np
import regex as re
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import statistics
import hdbscan
from collections import deque, defaultdict
import matplotlib.pyplot as plt
import matplotlib.patches as patches
def _plot_2d_word_clusters(words: List[Dict[str, Any]], labels: np.ndarray, coordinates_2d: np.ndarray, page_num: int, page_width: float, page_height: float):
  """Plot 2D HDBSCAN clusters for individual words"""
  try:
      # Create figure with subplots
      fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(20, 16))

      # Extract coordinates
      x_positions = coordinates_2d[:, 0]
      y_positions = coordinates_2d[:, 1]
      y_positions_flipped = page_height - coordinates_2d[:, 1]  # Flip for visualization

      # Get unique labels and colors
      unique_labels = set(labels)
      n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
      colors = plt.cm.Set1(np.linspace(0, 1, max(n_clusters, 1)))
      color_map = {}
      color_idx = 0

      for label in unique_labels:
          if label == -1:
              color_map[label] = 'black'
          else:
              color_map[label] = colors[color_idx % len(colors)]
              color_idx += 1

      # Plot 1: X-coordinates distribution
      ax1.set_title(f'Page {page_num}: Word X-Coordinates Distribution by Cluster')
      ax1.set_xlabel('X Position')
      ax1.set_ylabel('Count')

      for label in unique_labels:
          mask = labels == label
          cluster_x = x_positions[mask]

          if label == -1:
              label_name = f'Noise ({len(cluster_x)})'
              alpha = 0.6
          else:
              label_name = f'Cluster {label} ({len(cluster_x)})'
              alpha = 0.8

          ax1.hist(cluster_x, bins=30, alpha=alpha, color=color_map[label], 
                  label=label_name, edgecolor='black', linewidth=0.5)

      ax1.set_xlim(0, page_width)
      ax1.legend()
      ax1.grid(True, alpha=0.3)

      # Plot 2: Y-coordinates distribution
      ax2.set_title(f'Page {page_num}: Word Y-Coordinates Distribution by Cluster')
      ax2.set_xlabel('Y Position')
      ax2.set_ylabel('Count')

      for label in unique_labels:
          mask = labels == label
          cluster_y = y_positions[mask]

          if label == -1:
              label_name = f'Noise ({len(cluster_y)})'
              alpha = 0.6
          else:
              label_name = f'Cluster {label} ({len(cluster_y)})'
              alpha = 0.8

          ax2.hist(cluster_y, bins=30, alpha=alpha, color=color_map[label], 
                  label=label_name, edgecolor='black', linewidth=0.5)

      ax2.set_xlim(0, page_height)
      ax2.legend()
      ax2.grid(True, alpha=0.3)

      # Plot 3: 2D Scatter Plot (Page Layout View)
      ax3.set_title(f'Page {page_num}: 2D Word Layout with Clusters')
      ax3.set_xlabel('X Position')
      ax3.set_ylabel('Y Position (flipped for readability)')

      for label in unique_labels:
          mask = labels == label
          cluster_x = x_positions[mask]
          cluster_y = y_positions_flipped[mask]

          if label == -1:
              marker = 'x'
              size = 20
              alpha = 0.5
              label_name = f'Noise ({len(cluster_x)})'
          else:
              marker = 'o'
              size = 30
              alpha = 0.7
              label_name = f'Cluster {label} ({len(cluster_x)})'

          ax3.scatter(cluster_x, cluster_y, c=[color_map[label]], marker=marker, 
                     s=size, alpha=alpha, label=label_name, edgecolors='black', linewidth=0.3)

      ax3.set_xlim(0, page_width)
      ax3.set_ylim(0, page_height)
      ax3.legend()
      ax3.grid(True, alpha=0.3)

      # Plot 4: Cluster Statistics and Word Samples
      ax4.axis('off')
      ax4.set_title(f'Page {page_num}: Word Cluster Statistics', pad=20)

      # Create statistics text
      stats_text = []
      stats_text.append(f"Total Words: {len(words)}")
      stats_text.append(f"Total Clusters: {n_clusters}")
      stats_text.append(f"Noise Words: {np.sum(labels == -1)}")
      stats_text.append("")

      for label in sorted(unique_labels):
          mask = labels == label
          count = np.sum(mask)
          cluster_words = np.array(words)[mask]
          cluster_x = x_positions[mask]
          cluster_y = y_positions[mask]

          if label == -1:
              stats_text.append(f"Noise Words:")
          else:
              stats_text.append(f"Cluster {label}:")

          stats_text.append(f"  • Words: {count}")
          if len(cluster_x) > 0:
              stats_text.append(f"  • X Range: {min(cluster_x):.1f} - {max(cluster_x):.1f}")
              stats_text.append(f"  • Y Range: {min(cluster_y):.1f} - {max(cluster_y):.1f}")
              stats_text.append(f"  • X Center: {np.mean(cluster_x):.1f}")
              stats_text.append(f"  • Y Center: {np.mean(cluster_y):.1f}")

              # Show first few words from this cluster
              sample_words = [w["text"] for w in cluster_words[:3]]
              stats_text.append(f"  • Sample: {', '.join(sample_words)}")
          stats_text.append("")

      # Display statistics
      ax4.text(0.05, 0.95, '\n'.join(stats_text), transform=ax4.transAxes, 
              fontsize=9, verticalalignment='top', fontfamily='monospace',
              bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8))

      # Save plot
      plot_filename = f"2d_word_hdbscan_analysis_page_{page_num}.png"
      plt.tight_layout()
      plt.savefig(plot_filename, dpi=150, bbox_inches='tight')
      print(f"  📊 2D word cluster analysis plot saved: {plot_filename}")

      plt.close()  # Close to free memory

  except Exception as e:
      print(f"  ⚠️ Error plotting 2D word clusters: {e}")


