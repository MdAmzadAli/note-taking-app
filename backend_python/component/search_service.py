
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
        """
        Enhanced search with workspace-aware retrieval, MMR, and document bucketing
        """
        try:
            print(f'🔍 Enhanced search for: "{query}"')
            print(f'📄 FileIds: {len(file_ids) if file_ids else 0}, WorkspaceId: {workspace_id or "none"}')

            # For workspace mode (multiple files), use enhanced retrieval
            if workspace_id and file_ids and len(file_ids) > 1:
                return await self.search_workspace_relevant_chunks(query, file_ids, workspace_id, limit)

            # For single file, use standard search
            return await self.search_single_file_chunks(query, file_ids, workspace_id, limit)

        except Exception as error:
            print(f'❌ Enhanced search failed: {error}')
            raise error

    async def search_workspace_relevant_chunks(self, query: str, file_ids: List[str], 
                                             workspace_id: str, total_limit: int) -> List[Dict[str, Any]]:
        """
        Workspace-aware search with document bucketing and MMR
        """
        print(f'🏢 Workspace search: {len(file_ids)} files, limit: {total_limit}')
        print(f'📄 File IDs: [{", ".join(file_ids)}]')
        print(f'🏢 Workspace ID: {workspace_id}')
        
        query_embedding = await self.embedding_service.generate_embedding(query, 'query')
        print(f'🔍 Query embedding generated (length: {len(query_embedding)})')
        
        chunks_per_doc = max(2, total_limit // len(file_ids))  # Ensure each doc contributes
        retrieval_limit = chunks_per_doc * 3  # Get more candidates for MMR
        print(f'📊 Per-doc limit: {chunks_per_doc}, retrieval limit: {retrieval_limit}')

        all_candidates = []
        documents_searched = 0
        documents_with_results = 0

        # Step 1: Retrieve top candidates from each document individually
        for file_id in file_ids:
            documents_searched += 1
            try:
                print(f'📄 [{documents_searched}/{len(file_ids)}] Searching in document: {file_id}')
                
                # Primary search: with both fileId and workspaceId filters
                primary_filter = { 
                    'must': [
                        {'key': 'fileId', 'match': {'value': file_id}},
                        {'key': 'workspaceId', 'match': {'value': workspace_id}}
                    ]
                }
                print(f'🔍 Primary filter: {primary_filter}')

                doc_results = await self.vector_database_service.search_similar_chunks(
                    query_embedding, 
                    primary_filter, 
                    retrieval_limit
                )
                print(f'📊 Primary search results for {file_id}: {len(doc_results)} chunks')

                if len(doc_results) > 0:
                    print(f'✅ Primary search found {len(doc_results)} candidates from {file_id}')
                    documents_with_results += 1
                else:
                    print(f'⚠️ No results from primary search for {file_id}, trying fallbacks...')
                    
                    # Fallback 1: Search without workspace filter
                    try:
                        fallback_filter1 = { 
                            'must': [{'key': 'fileId', 'match': {'value': file_id}}]
                        }
                        print(f'🔍 Fallback 1 filter: {fallback_filter1}')
                        
                        doc_results = await self.vector_database_service.search_similar_chunks(
                            query_embedding, 
                            fallback_filter1, 
                            retrieval_limit
                        )
                        print(f'📊 Fallback 1 results for {file_id}: {len(doc_results)} chunks')
                        
                        if len(doc_results) > 0:
                            print(f'✅ Fallback 1 found {len(doc_results)} candidates from {file_id}')
                            
                            # Manual workspace filtering
                            if workspace_id:
                                before_filter = len(doc_results)
                                print(f'🔍 Manual workspace filtering: looking for workspaceId="{workspace_id}"')
                                
                                filtered_results = []
                                for result in doc_results:
                                    has_workspace = result.get('payload', {}).get('workspaceId') == workspace_id
                                    if has_workspace:
                                        filtered_results.append(result)
                                        print(f'   ✅ Keeping: fileId={result.get("payload", {}).get("fileId")}, workspaceId="{result.get("payload", {}).get("workspaceId")}" (matches "{workspace_id}")')
                                    else:
                                        print(f'   ❌ Filtering out: fileId={result.get("payload", {}).get("fileId")}, workspaceId="{result.get("payload", {}).get("workspaceId")}" (doesn\'t match "{workspace_id}")')
                                
                                doc_results = filtered_results
                                print(f'📄 Manual workspace filter: {before_filter} → {len(doc_results)} candidates')
                            
                            if len(doc_results) > 0:
                                documents_with_results += 1
                        else:
                            # Fallback 2: Search without any filters
                            print(f'⚠️ Fallback 1 failed, trying fallback 2 (no filters)...')
                            
                            doc_results = await self.vector_database_service.search_similar_chunks(
                                query_embedding, 
                                None, 
                                retrieval_limit * 2  # Get more results to filter manually
                            )
                            print(f'📊 Fallback 2 results (no filter): {len(doc_results)} chunks')
                            
                            if len(doc_results) > 0:
                                # Manual filtering for both fileId and workspaceId
                                before_filter = len(doc_results)
                                print(f'🔍 Manual filtering: looking for fileId="{file_id}" and workspaceId="{workspace_id}"')
                                
                                filtered_results = []
                                for result in doc_results:
                                    file_match = result.get('payload', {}).get('fileId') == file_id
                                    workspace_match = not workspace_id or result.get('payload', {}).get('workspaceId') == workspace_id
                                    should_keep = file_match and workspace_match
                                    
                                    if should_keep:
                                        filtered_results.append(result)
                                    else:
                                        print(f'   ❌ Filtering out: fileId={result.get("payload", {}).get("fileId")} (match:{file_match}), workspaceId="{result.get("payload", {}).get("workspaceId")}" (match:{workspace_match})')
                                
                                doc_results = filtered_results
                                print(f'📄 Manual filtering: {before_filter} → {len(doc_results)} candidates for {file_id}')
                                
                                if len(doc_results) > 0:
                                    documents_with_results += 1
                                    print(f'✅ Fallback 2 found {len(doc_results)} candidates from {file_id}')
                    except Exception as fallback_error:
                        print(f'⚠️ All fallback searches failed for {file_id}: {fallback_error}')

                if len(doc_results) > 0:
                    # Log sample results for debugging
                    if len(doc_results) > 0:
                        first_result = doc_results[0]
                        payload = first_result.get('payload', {})
                        print(f'📝 Sample result from {file_id}:', {
                            'score': first_result.get('score'),
                            'textPreview': payload.get('text', '')[:100] + '...',
                            'fileName': payload.get('fileName'),
                            'workspaceId': payload.get('workspaceId'),
                            'chunkIndex': payload.get('chunkIndex')
                        })
                    
                    # Add document-specific context
                    processed_results = []
                    for result in doc_results:
                        payload = result.get('payload', {})
                        metadata = {
                            'fileId': payload.get('fileId'),
                            'fileName': payload.get('fileName'),
                            'chunkIndex': payload.get('chunkIndex'),
                            'workspaceId': payload.get('workspaceId'),
                            'linesUsed': payload.get('linesUsed', []),
                            'originalLines': payload.get('originalLines', []),
                            'pageUrl': payload.get('pageUrl'),
                            'cloudinaryUrl': payload.get('cloudinaryUrl'),
                            'thumbnailUrl': payload.get('thumbnailUrl'),
                            'embeddingType': payload.get('embeddingType')
                        }

                        # Add page and line numbers only if they exist (PDF content)
                        if payload.get('pageNumber') is not None:
                            metadata['pageNumber'] = payload.get('pageNumber')
                            metadata['totalPages'] = payload.get('totalPages')
                            metadata['totalLinesOnPage'] = payload.get('totalLinesOnPage')
                        
                        if payload.get('startLine') is not None:
                            metadata['startLine'] = payload.get('startLine')
                            metadata['endLine'] = payload.get('endLine')

                        processed_results.append({
                            'text': payload.get('text'),
                            'score': result.get('score'),
                            'fileId': payload.get('fileId'),
                            'vector': result.get('vector'),  # Store for MMR if available
                            'metadata': metadata
                        })

                    all_candidates.extend(processed_results)
                    print(f'📊 Added {len(processed_results)} candidates from {file_id}, total: {len(all_candidates)}')
                else:
                    print(f'❌ No candidates found for document {file_id} after all search attempts')
            except Exception as doc_error:
                print(f'⚠️ Failed to search document {file_id}: {doc_error}')

        print(f'📊 Workspace search summary:')
        print(f'   - Documents searched: {documents_searched}')
        print(f'   - Documents with results: {documents_with_results}')
        print(f'   - Total candidates: {len(all_candidates)}')

        if len(all_candidates) == 0:
            print(f'❌ No candidates found across {len(file_ids)} documents')
            return []

        print(f'📊 Candidate score distribution: {[c["score"] for c in sorted(all_candidates, key=lambda x: x["score"], reverse=True)][:5]}')

        # Step 2: Apply MMR for diversity and document representation
        selected_chunks = self.apply_mmr(all_candidates, query_embedding, total_limit, chunks_per_doc)
        
        print(f'🎯 Final selection: {len(selected_chunks)} chunks from workspace')
        distribution = {}
        for chunk in selected_chunks:
            file_name = chunk['metadata']['fileName']
            distribution[file_name] = distribution.get(file_name, 0) + 1
        print(f'📊 Final chunks distribution: {distribution}')
        
        return selected_chunks

    async def search_single_file_chunks(self, query: str, file_ids: Optional[List[str]], 
                                      workspace_id: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """
        Standard single-file search
        """
        query_embedding = await self.embedding_service.generate_embedding(query, 'query')

        # Build filter
        filter_conditions = {'must': []}

        if file_ids and len(file_ids) > 0:
            filter_conditions['must'].append({
                'key': 'fileId',
                'match': {'any': file_ids}
            })

        if workspace_id:
            filter_conditions['must'].append({
                'key': 'workspaceId',
                'match': {'value': workspace_id}
            })

        search_result = []

        try:
            search_result = await self.vector_database_service.search_similar_chunks(
                query_embedding,
                filter_conditions if len(filter_conditions['must']) > 0 else None,
                limit
            )
        except Exception as filter_error:
            print(f'⚠️ Search with filter failed, trying without filters: {filter_error}')
            
            if 'Index required' in str(filter_error):
                print('🔄 Retrying search without filters...')
                search_result = await self.vector_database_service.search_similar_chunks(
                    query_embedding,
                    None,
                    limit * 2
                )

                # Manual filtering
                if file_ids and len(file_ids) > 0:
                    search_result = [result for result in search_result 
                                   if result.get('payload', {}).get('fileId') in file_ids]

                if workspace_id:
                    search_result = [result for result in search_result 
                                   if result.get('payload', {}).get('workspaceId') == workspace_id]

                search_result = search_result[:limit]
            else:
                raise filter_error

        print(f'🎯 Found {len(search_result)} relevant chunks using standard search')

        formatted_results = []
        for result in search_result:
            payload = result.get('payload', {})
            metadata = {
                'fileId': payload.get('fileId'),
                'fileName': payload.get('fileName'),
                'chunkIndex': payload.get('chunkIndex'),
                'workspaceId': payload.get('workspaceId'),
                'linesUsed': payload.get('linesUsed', []),
                'originalLines': payload.get('originalLines', []),
                'pageUrl': payload.get('pageUrl'),
                'cloudinaryUrl': payload.get('cloudinaryUrl'),
                'thumbnailUrl': payload.get('thumbnailUrl'),
                'embeddingType': payload.get('embeddingType')
            }

            # Add page and line numbers only if they exist (PDF content)
            if payload.get('pageNumber') is not None:
                metadata['pageNumber'] = payload.get('pageNumber')
                metadata['totalPages'] = payload.get('totalPages')
                metadata['totalLinesOnPage'] = payload.get('totalLinesOnPage')
            
            if payload.get('startLine') is not None:
                metadata['startLine'] = payload.get('startLine')
                metadata['endLine'] = payload.get('endLine')

            formatted_results.append({
                'text': payload.get('text'),
                'score': result.get('score'),
                'metadata': metadata
            })

        return formatted_results

    def apply_mmr(self, candidates: List[Dict[str, Any]], query_embedding: List[float], 
                  total_limit: int, min_per_doc: int = 1) -> List[Dict[str, Any]]:
        """
        MMR implementation for diversity and document representation
        """
        if len(candidates) <= total_limit:
            return candidates

        print(f'🔄 Applying MMR to {len(candidates)} candidates')

        # Sort by score initially
        candidates.sort(key=lambda x: x['score'], reverse=True)

        selected = []
        remaining = candidates.copy()
        doc_counts = {}

        # MMR parameters
        lambda_param = 0.7  # Balance between relevance and diversity

        # First, ensure minimum representation per document
        unique_file_ids = list(set(c['fileId'] for c in candidates))
        
        for file_id in unique_file_ids:
            doc_candidates = [c for c in candidates if c['fileId'] == file_id]
            needed = min(min_per_doc, len(doc_candidates))
            
            for i in range(needed):
                if len(selected) < total_limit:
                    selected.append(doc_candidates[i])
                    doc_counts[file_id] = doc_counts.get(file_id, 0) + 1
                    
                    # Remove from remaining
                    remaining = [r for r in remaining 
                               if not (r['fileId'] == doc_candidates[i]['fileId'] and 
                                      r['metadata']['chunkIndex'] == doc_candidates[i]['metadata']['chunkIndex'])]

        print(f'📋 Ensured minimum representation: {len(selected)} chunks')

        # Fill remaining slots with MMR
        while len(selected) < total_limit and len(remaining) > 0:
            best_candidate = None
            best_score = float('-inf')

            for candidate in remaining:
                # Relevance score (similarity to query)
                relevance_score = candidate['score']

                # Diversity score (dissimilarity to already selected)
                max_similarity = 0
                for selected_chunk in selected:
                    # Simple text-based similarity as fallback
                    similarity = self.compute_text_similarity(candidate['text'], selected_chunk['text'])
                    max_similarity = max(max_similarity, similarity)

                # MMR score: λ * relevance - (1-λ) * max_similarity
                mmr_score = lambda_param * relevance_score - (1 - lambda_param) * max_similarity

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_candidate = candidate

            if best_candidate:
                selected.append(best_candidate)
                doc_counts[best_candidate['fileId']] = doc_counts.get(best_candidate['fileId'], 0) + 1
                
                remaining = [r for r in remaining 
                           if not (r['fileId'] == best_candidate['fileId'] and 
                                  r['metadata']['chunkIndex'] == best_candidate['metadata']['chunkIndex'])]
            else:
                break

        print(f'✅ MMR selection complete: {len(selected)} chunks')
        print(f'📊 Document distribution: {doc_counts}')

        return selected

    def compute_text_similarity(self, text1: str, text2: str) -> float:
        """
        Simple text similarity for MMR
        """
        if not text1 or not text2:
            return 0.0

        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if len(union) > 0 else 0.0
