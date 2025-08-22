
import asyncio
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import re

class SearchService:
    def __init__(self, embedding_service, vector_database_service):
        self.embedding_service = embedding_service
        self.vector_database_service = vector_database_service

    async def search_relevant_chunks(self, query: str, file_ids: Optional[List[str]] = None, 
                                   workspace_id: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        try:
            print(f'🔍 SearchService: Searching for "{query}"')
            print(f'📁 File IDs: {file_ids}')
            print(f'🏢 Workspace ID: {workspace_id}')
            print(f'📊 Limit: {limit}')

            # Check if this is a workspace query (multiple files)
            is_workspace_query = workspace_id and file_ids and len(file_ids) > 1

            if is_workspace_query:
                print('🏢 Processing as workspace query with multiple files')
                return await self.search_workspace_relevant_chunks(query, file_ids, workspace_id, limit)
            else:
                print('📄 Processing as single file query')
                return await self.search_single_file_chunks(query, file_ids, workspace_id, limit)

        except Exception as error:
            print(f'❌ SearchService: Search failed: {error}')
            raise error

    async def search_workspace_relevant_chunks(self, query: str, file_ids: List[str], 
                                             workspace_id: str, total_limit: int) -> List[Dict[str, Any]]:
        try:
            print(f'🏢 Workspace search for {len(file_ids)} files with total limit {total_limit}')

            # Generate query embedding
            query_embedding = await self.embedding_service.generate_embedding(query)

            # Search across all files with a higher limit to get diverse results
            search_limit = min(total_limit * 3, 50)  # Get more candidates for MMR
            candidates = await self.vector_database_service.search_similar_chunks(
                query_embedding, file_ids, workspace_id, search_limit
            )

            if not candidates:
                return []

            print(f'📊 Found {len(candidates)} candidate chunks before MMR')

            # Apply MMR for diversity across documents
            min_per_doc = max(1, total_limit // len(file_ids))  # Ensure each file gets at least one result
            final_results = self.apply_mmr(candidates, query_embedding, total_limit, min_per_doc)

            print(f'✅ Final workspace results: {len(final_results)} chunks from {len(set(r["metadata"]["fileId"] for r in final_results))} files')
            return final_results

        except Exception as error:
            print(f'❌ Workspace search failed: {error}')
            raise error

    async def search_single_file_chunks(self, query: str, file_ids: Optional[List[str]], 
                                      workspace_id: Optional[str], limit: int) -> List[Dict[str, Any]]:
        try:
            print(f'📄 Single file search with limit {limit}')

            # Generate query embedding
            query_embedding = await self.embedding_service.generate_embedding(query)

            # Search with the requested limit
            results = await self.vector_database_service.search_similar_chunks(
                query_embedding, file_ids, workspace_id, limit
            )

            print(f'✅ Single file results: {len(results)} chunks')
            return results

        except Exception as error:
            print(f'❌ Single file search failed: {error}')
            raise error

    def apply_mmr(self, candidates: List[Dict[str, Any]], query_embedding: List[float], 
                  total_limit: int, min_per_doc: int = 1) -> List[Dict[str, Any]]:
        """
        Apply Maximal Marginal Relevance for diversity
        """
        try:
            print(f'🎯 Applying MMR: {len(candidates)} candidates → {total_limit} results (min {min_per_doc} per doc)')

            if not candidates or total_limit <= 0:
                return []

            if len(candidates) <= total_limit:
                return candidates[:total_limit]

            # Group candidates by file
            file_groups = {}
            for candidate in candidates:
                file_id = candidate['metadata']['fileId']
                if file_id not in file_groups:
                    file_groups[file_id] = []
                file_groups[file_id].append(candidate)

            # Sort each group by relevance score
            for file_id in file_groups:
                file_groups[file_id].sort(key=lambda x: x['score'], reverse=True)

            print(f'📊 File distribution: {[(fid[:8] + "...", len(chunks)) for fid, chunks in file_groups.items()]}')

            selected = []
            file_counters = {file_id: 0 for file_id in file_groups.keys()}

            # Phase 1: Ensure minimum representation per document
            for file_id, chunks in file_groups.items():
                for chunk in chunks[:min_per_doc]:
                    if len(selected) < total_limit:
                        selected.append(chunk)
                        file_counters[file_id] += 1

            # Phase 2: Fill remaining slots with best remaining candidates
            remaining_candidates = []
            for file_id, chunks in file_groups.items():
                remaining_candidates.extend(chunks[file_counters[file_id]:])

            # Sort remaining by score and add until we reach the limit
            remaining_candidates.sort(key=lambda x: x['score'], reverse=True)
            for candidate in remaining_candidates:
                if len(selected) < total_limit:
                    selected.append(candidate)
                else:
                    break

            # Sort final results by score
            selected.sort(key=lambda x: x['score'], reverse=True)

            print(f'✅ MMR complete: {len(selected)} chunks selected')
            final_file_dist = {}
            for chunk in selected:
                file_id = chunk['metadata']['fileId']
                final_file_dist[file_id] = final_file_dist.get(file_id, 0) + 1
            print(f'📊 Final distribution: {[(fid[:8] + "...", count) for fid, count in final_file_dist.items()]}')

            return selected

        except Exception as error:
            print(f'❌ MMR failed: {error}')
            # Fallback to simple top-k selection
            return candidates[:total_limit]

    def compute_text_similarity(self, text1: str, text2: str) -> float:
        """
        Compute similarity between two texts using TF-IDF cosine similarity
        """
        try:
            if not text1 or not text2:
                return 0.0

            # Clean and preprocess texts
            clean_text1 = self._clean_text(text1)
            clean_text2 = self._clean_text(text2)

            if not clean_text1 or not clean_text2:
                return 0.0

            # Use TF-IDF vectorizer
            vectorizer = TfidfVectorizer(
                stop_words='english',
                lowercase=True,
                ngram_range=(1, 2),
                max_features=1000
            )

            try:
                tfidf_matrix = vectorizer.fit_transform([clean_text1, clean_text2])
                similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                return float(similarity)
            except:
                # Fallback to simple word overlap
                words1 = set(clean_text1.lower().split())
                words2 = set(clean_text2.lower().split())
                intersection = words1.intersection(words2)
                union = words1.union(words2)
                return len(intersection) / len(union) if union else 0.0

        except Exception as error:
            print(f'❌ Text similarity computation failed: {error}')
            return 0.0

    def _clean_text(self, text: str) -> str:
        """Clean text for similarity computation"""
        if not text:
            return ""
        
        # Remove special characters and extra whitespace
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
