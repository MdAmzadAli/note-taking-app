import asyncio
import json
import re
from typing import List, Dict, Any, Optional

class AnswerGenerationService:
    def __init__(self, embedding_service, search_service):
        self.embedding_service = embedding_service
        self.search_service = search_service

    async def generate_answer(self, query: str, file_ids: Optional[List[str]] = None, 
                            workspace_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            print(f'🤖 Starting new 2-step LLM flow for: "{query}"')

            # Determine if this is single file mode or workspace mode
            is_single_file_mode = workspace_id and workspace_id.startswith("single_")
            is_workspace_mode = workspace_id and not workspace_id.startswith("single_") and file_ids and len(file_ids) > 1

            print(f'📊 Mode Detection: Single={is_single_file_mode}, Workspace={is_workspace_mode}, WorkspaceId={workspace_id}')

            # Search for relevant chunks with appropriate limits
            chunk_limit = 12 if is_workspace_mode else 6
            relevant_chunks = await self.search_service.search_relevant_chunks(
                query,
                file_ids,
                workspace_id,
                chunk_limit
            )

            if not relevant_chunks:
                return {
                    'answer': "I couldn't find relevant information in the uploaded documents to answer your question.",
                    'sources': [],
                    'confidence': 0
                }

            # Step 1: Reasoning complexity classification
            complexity_result = await self.step1_reasoning_complexity_router(query, relevant_chunks, bool(is_single_file_mode), bool(is_workspace_mode))

            print(f'🧠 Step 1 Result: Complexity={complexity_result["complexity"]}, Mode={"Single" if is_single_file_mode else "Workspace" if is_workspace_mode else "Unknown"}, Reasoning="{complexity_result["reasoning"]}"')

            # Step 2: Unified answer generation based on complexity
            return await self.step2_unified_answer_generation(query, relevant_chunks, complexity_result, bool(is_single_file_mode), bool(is_workspace_mode))

        except Exception as error:
            print(f'❌ 2-step answer generation failed: {error}')
            raise error

    async def step1_reasoning_complexity_router(self, user_query: str, relevant_chunks: List[Dict], 
                                               is_single_file_mode: bool = False, is_workspace_mode: bool = False) -> Dict[str, Any]:
        print(f'🧠 Step 1: Reasoning complexity classification (Single: {is_single_file_mode}, Workspace: {is_workspace_mode})...')

        if not self.embedding_service.chat_client:
            raise Exception("Google GenAI Chat client not initialized")

        # Analyze document context for complexity assessment
        document_types = list(set(chunk['metadata']['fileName'] for chunk in relevant_chunks))
        has_table_content = any(chunk['metadata'].get('hasTableContent', False) for chunk in relevant_chunks)
        has_json_tables = any(chunk['metadata'].get('has_json_tables', False) for chunk in relevant_chunks)
        has_financial_data = any(chunk['metadata'].get('hasFinancialData', False) for chunk in relevant_chunks)
        has_structured_tables = any(chunk.get('structured_tables') for chunk in relevant_chunks)
        
        # Count table chunks and analyze numerical content
        table_chunks = [chunk for chunk in relevant_chunks if chunk['metadata'].get('hasTableContent', False)]
        table_count = len(table_chunks)
        
        # Analyze table metadata for complexity indicators
        table_headers = []
        table_currencies = []
        for chunk in table_chunks:
            numeric_metadata = chunk['metadata'].get('numeric_metadata', {})
            if numeric_metadata:
                table_headers.extend(numeric_metadata.get('table_context_headings', []))
                table_currencies.extend(numeric_metadata.get('currencies', []))

        mode_info = "Single file mode" if is_single_file_mode else "Workspace mode" if is_workspace_mode else "Standard mode"
        context_info = f"Mode: {mode_info}. Documents: {', '.join(document_types)}. Tables: {table_count} chunks, JSON tables: {has_json_tables}, Structured tables: {has_structured_tables}. Financial data: {has_financial_data}. Table contexts: {table_headers[:3]}."

        complexity_router_prompt = f"""You are an expert query complexity analyzer. Analyze the user query and document context to determine the reasoning complexity level required to answer this query effectively.

USER QUERY: {user_query}
DOCUMENT CONTEXT: {context_info}

COMPLEXITY LEVELS TO CLASSIFY:

1. **SIMPLE**: Basic information retrieval or straightforward questions
   - Direct fact lookup from text or tables
   - Simple definitions or explanations
   - Single-step information extraction
   - Questions with clear, direct answers
   - Examples: "What is the company name?", "List the cities in the table", "What is the definition of X?"

2. **MEDIUM**: Moderate analysis requiring some reasoning or synthesis
   - Comparative questions requiring multiple data points
   - Summarization of information across sections
   - Basic calculations or simple aggregations
   - Questions requiring understanding of relationships
   - Cross-referencing between different parts of documents
   - Examples: "Compare these two products", "What are the main themes?", "Calculate the total of these amounts"

3. **COMPLEX**: Advanced reasoning requiring deep analysis or multi-step processing
   - Multi-step computational analysis with complex calculations
   - Advanced comparative analysis across multiple documents
   - Questions requiring interpretation and inference
   - Complex financial or statistical analysis
   - Synthesis of information from multiple sources with sophisticated reasoning
   - Questions involving ranking, optimization, or complex decision-making
   - Examples: "Which investment strategy would be most profitable and why?", "Analyze the financial trends and provide recommendations", "What are the interconnected impacts of these policy changes?"

CLASSIFICATION RULES:
- Single file mode: Focus on individual document complexity
- Workspace mode: Consider cross-document complexity and comparison needs
- Table-heavy queries: Medium complexity unless requiring advanced calculations
- Financial/computational queries: Medium to Complex based on calculation sophistication
- Multi-document comparison in workspace mode: Generally Medium or Complex
- If query requires deep reasoning, inference, or multi-step analysis: Complex
- If query asks for simple facts or basic data retrieval: Simple
- If query requires moderate analysis or synthesis: Medium

Return ONLY this JSON format:
{{
  "complexity": "simple" | "medium" | "complex",
  "reasoning": "Brief explanation of why this complexity level was chosen",
  "confidenceScore": 0.0-1.0,
  "keyIndicators": ["list", "of", "key", "factors", "that", "influenced", "classification"],
  "processingMode": "{mode_info}",
  "documentFeatures": {{
    "hasTableContent": {has_table_content},
    "hasFinancialData": {has_financial_data},
    "documentCount": {len(document_types)},
    "tableCount": {table_count}
  }}
}}"""

        try:
            # Use gemini-1.5-flash-8b for Step 1 router
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model='gemini-1.5-flash-8b',
                contents=[complexity_router_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.8,
                    max_output_tokens=512
                )
            )

            response_text = response.text
            print(f'🧠 Step 1: Raw complexity response: {response_text}')
            json_match = re.search(r'\{[\s\S]*\}', response_text)

            if json_match:
                result = json.loads(json_match.group())
                print(f'✅ Step 1: {result["complexity"]} complexity identified - {result["reasoning"]}')
                return result

        except Exception as parse_error:
            print(f'⚠️ Step 1: JSON parsing failed, using fallback classification: {parse_error}')

        # Enhanced fallback classification based on query analysis
        query_lower = user_query.lower()
        
        # Define complexity indicators
        simple_keywords = ['what is', 'define', 'list', 'show', 'find', 'name', 'who', 'when', 'where']
        medium_keywords = ['compare', 'analyze', 'summary', 'total', 'average', 'difference', 'calculate', 'how many']
        complex_keywords = ['strategy', 'recommendation', 'optimize', 'evaluate', 'assess', 'trend', 'impact', 'relationship', 'correlation']
        
        # Count indicators
        simple_count = sum(1 for keyword in simple_keywords if keyword in query_lower)
        medium_count = sum(1 for keyword in medium_keywords if keyword in query_lower)
        complex_count = sum(1 for keyword in complex_keywords if keyword in query_lower)
        
        # Determine complexity based on various factors
        complexity = 'simple'  # default
        reasoning = f'Fallback classification ({mode_info})'
        
        if complex_count > 0 or (is_workspace_mode and len(document_types) > 3):
            complexity = 'complex'
            reasoning += ': Complex keywords or multi-document workspace analysis'
        elif medium_count > 0 or has_financial_data or table_count > 2:
            complexity = 'medium' 
            reasoning += ': Medium keywords, financial data, or multiple tables'
        elif simple_count > 0:
            complexity = 'simple'
            reasoning += ': Simple keywords and straightforward query'
        
        return {
            'complexity': complexity,
            'reasoning': reasoning,
            'confidenceScore': 0.7,
            'keyIndicators': [f'simple_count={simple_count}', f'medium_count={medium_count}', f'complex_count={complex_count}'],
            'processingMode': mode_info,
            'documentFeatures': {
                'hasTableContent': has_table_content,
                'hasFinancialData': has_financial_data,
                'documentCount': len(document_types),
                'tableCount': table_count
            }
        }

    async def step2_unified_answer_generation(self, user_query: str, relevant_chunks: List[Dict], 
                                             complexity_result: Dict[str, Any], is_single_file_mode: bool = False, 
                                             is_workspace_mode: bool = False) -> Dict[str, Any]:
        print(f'📝 Step 2: Routing to {complexity_result["complexity"]} complexity handler...')

        complexity = complexity_result['complexity']
        
        # Route to specific complexity handler
        if complexity == 'simple':
            return await self.step2_simple_query(user_query, relevant_chunks, complexity_result, is_single_file_mode, is_workspace_mode)
        elif complexity == 'medium':
            return await self.step2_medium_query(user_query, relevant_chunks, complexity_result, is_single_file_mode, is_workspace_mode)
        else:  # complex
            return await self.step2_complex_query(user_query, relevant_chunks, complexity_result, is_single_file_mode, is_workspace_mode)

    async def step2_simple_query(self, user_query: str, relevant_chunks: List[Dict], 
                                complexity_result: Dict[str, Any], is_single_file_mode: bool = False, 
                                is_workspace_mode: bool = False) -> Dict[str, Any]:
        print(f'📖 Step 2: Simple query processing...')

        if not self.embedding_service.chat_client:
            raise Exception("Google GenAI Chat client not initialized")

        # Build context for simple queries
        context = self._build_context_for_query(relevant_chunks)
        mode_info = "Single file mode" if is_single_file_mode else "Workspace mode" if is_workspace_mode else "Standard mode"

        simple_prompt = f"""Answer this straightforward question using the document content below.

USER QUERY: {user_query}

CONTEXT FROM DOCUMENTS:
{context}

INSTRUCTIONS:
- Provide a direct, clear answer
- Use simple, straightforward language  
- Quote specific information from the documents
- Reference context numbers when citing (e.g., [Context 2])
- Keep the answer concise and focused

CRITICAL: After your answer, list which contexts you used:
---
CONTEXTS_USED: [list context numbers you referenced (e.g., "1,3")]

ANSWER:"""

        try:
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model='gemini-2.0-flash-lite',
                contents=[simple_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=0.2,
                    top_p=0.8,
                    max_output_tokens=1024
                )
            )

            return self._process_response_and_build_result(response.text, relevant_chunks, complexity_result, 'gemini-2.0-flash-lite', mode_info)

        except Exception as error:
            print(f'❌ Simple query processing failed: {error}')
            raise error

    async def step2_medium_query(self, user_query: str, relevant_chunks: List[Dict], 
                                complexity_result: Dict[str, Any], is_single_file_mode: bool = False, 
                                is_workspace_mode: bool = False) -> Dict[str, Any]:
        print(f'🔍 Step 2: Medium query processing...')

        if not self.embedding_service.chat_client:
            raise Exception("Google GenAI Chat client not initialized")

        # Build enhanced context for medium queries
        context = self._build_context_for_query(relevant_chunks)
        mode_info = "Single file mode" if is_single_file_mode else "Workspace mode" if is_workspace_mode else "Standard mode"

        medium_prompt = f"""Analyze and answer this question requiring moderate reasoning using the document content.

USER QUERY: {user_query}

CONTEXT FROM DOCUMENTS:
{context}

INSTRUCTIONS:
- Provide a well-structured answer with analysis
- Include comparisons, calculations, or synthesis as needed
- Use **bold text** for key terms and important numbers
- Organize with bullet points or numbered lists when appropriate
- Show your reasoning process clearly
- {"Focus on individual document analysis" if is_single_file_mode else "Compare across documents when relevant" if is_workspace_mode else "Standard analysis"}

CRITICAL: After your answer, list which contexts you used:
---
CONTEXTS_USED: [list context numbers you referenced (e.g., "1,3,5")]

ANSWER:"""

        try:
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model='gemini-2.5-flash-lite',
                contents=[medium_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=0.3,
                    top_p=0.8,
                    max_output_tokens=2048
                )
            )

            return self._process_response_and_build_result(response.text, relevant_chunks, complexity_result, 'gemini-2.5-flash-lite', mode_info)

        except Exception as error:
            print(f'❌ Medium query processing failed: {error}')
            raise error

    async def step2_complex_query(self, user_query: str, relevant_chunks: List[Dict], 
                                 complexity_result: Dict[str, Any], is_single_file_mode: bool = False, 
                                 is_workspace_mode: bool = False) -> Dict[str, Any]:
        print(f'🧠 Step 2: Complex query processing...')

        if not self.embedding_service.chat_client:
            raise Exception("Google GenAI Chat client not initialized")

        # Build comprehensive context for complex queries
        context = self._build_context_for_query(relevant_chunks)
        mode_info = "Single file mode" if is_single_file_mode else "Workspace mode" if is_workspace_mode else "Standard mode"

        complex_prompt = f"""Provide comprehensive analysis for this complex question requiring deep reasoning.

USER QUERY: {user_query}

CONTEXT FROM DOCUMENTS:
{context}

INSTRUCTIONS:
- Deliver in-depth, sophisticated analysis
- Include multi-step reasoning and synthesis
- Create clear sections with detailed organization
- Perform advanced calculations, trend analysis, or strategic reasoning
- Provide recommendations or insights based on thorough analysis
- Use multiple formatting elements (**bold**, bullet points, sections)
- {"Analyze patterns within the document" if is_single_file_mode else "Synthesize insights across multiple documents" if is_workspace_mode else "Comprehensive document analysis"}

STRUCTURE YOUR RESPONSE:
1. **Executive Summary** (key findings)
2. **Detailed Analysis** (with evidence)
3. **Conclusions/Recommendations** (if applicable)

CRITICAL: After your answer, list which contexts you used:
---
CONTEXTS_USED: [list context numbers you referenced (e.g., "1,2,4,6")]

ANSWER:"""

        try:
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model='gemini-2.5-flash',
                contents=[complex_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.8,
                    max_output_tokens=3072
                )
            )

            return self._process_response_and_build_result(response.text, relevant_chunks, complexity_result, 'gemini-2.5-flash', mode_info)

        except Exception as error:
            print(f'❌ Complex query processing failed: {error}')
            raise error

    def _build_context_for_query(self, relevant_chunks: List[Dict]) -> str:
        """Build context string for queries with enhanced metadata"""
        context_parts = []
        for index, chunk in enumerate(relevant_chunks):
            confidence = f"{chunk['score'] * 100:.1f}"
            location_info = ''

            # Build location info only if page/line data exists
            if chunk['metadata'].get('pageNumber') is not None:
                location_info = f"Page {chunk['metadata']['pageNumber']}"
                if chunk['metadata'].get('startLine') is not None:
                    location_info += f", Lines {chunk['metadata']['startLine']}-{chunk['metadata']['endLine']}"
            else:
                location_info = 'Content'

            # Highlight special content types
            content_tags = []
            if chunk['metadata'].get('hasTableContent', False):
                content_tags.append('TABLE')
            if chunk['metadata'].get('hasFinancialData', False):
                content_tags.append('FINANCIAL')
            if chunk.get('structured_tables'):
                content_tags.append('STRUCTURED')
            
            tag_info = f" [{','.join(content_tags)}]" if content_tags else ""
            
            context_parts.append(f"[Context {index + 1} - {chunk['metadata']['fileName']} - {location_info}{tag_info} - Relevance: {confidence}%]: {chunk['text']}")

        return '\n\n'.join(context_parts)

    def _process_response_and_build_result(self, full_response: str, relevant_chunks: List[Dict], 
                                          complexity_result: Dict[str, Any], model_name: str, mode_info: str) -> Dict[str, Any]:
        """Process LLM response and build standardized result"""
        # Extract used contexts and clean answer
        answer = full_response
        used_context_numbers = []

        contexts_used_match = re.search(r'CONTEXTS_USED:\s*\[(.*?)\]', full_response)
        if contexts_used_match:
            contexts_used_str = contexts_used_match.group(1)
            used_context_numbers = [
                int(s.strip()) for s in contexts_used_str.split(',') 
                if s.strip().isdigit() and 1 <= int(s.strip()) <= len(relevant_chunks)
            ]

            answer = re.sub(r'---\s*CONTEXTS_USED:.*$', '', full_response, flags=re.DOTALL).strip()
            print(f'🎯 Used {len(used_context_numbers)} contexts: [{", ".join(map(str, used_context_numbers))}]')
        else:
            print('⚠️ Could not extract CONTEXTS_USED, using all contexts')
            used_context_numbers = list(range(1, len(relevant_chunks) + 1))

        # Build sources from used contexts
        sources = self._build_sources_from_context_numbers(relevant_chunks, used_context_numbers)

        # Determine analysis type based on complexity and features
        complexity = complexity_result['complexity']
        analysis_type = f"{complexity}-complexity"
        if complexity_result['documentFeatures'].get('hasTableContent', False):
            analysis_type += "-table-aware"
        if complexity_result['documentFeatures'].get('hasFinancialData', False):
            analysis_type += "-financial"
        if "Workspace" in mode_info:
            analysis_type += "-workspace"
        elif "Single file" in mode_info:
            analysis_type += "-single-file"

        return {
            'answer': answer,
            'sources': sources,
            'confidence': relevant_chunks[0]['score'] if relevant_chunks else 0,
            'analysisType': analysis_type,
            'processingStats': {
                'complexity': complexity,
                'modelUsed': model_name,
                'totalContexts': len(relevant_chunks),
                'usedContexts': len(used_context_numbers),
                'processingMode': mode_info,
                'confidenceScore': complexity_result.get('confidenceScore', 0.0),
                'documentFeatures': complexity_result.get('documentFeatures', {})
            }
        }

    def _build_sources_from_context_numbers(self, relevant_chunks: List[Dict], used_context_numbers: List[int]) -> List[Dict]:
        """Build sources from context numbers (1-based) - preserve original context numbers"""
        sources = []
        for context_num in used_context_numbers:
            if 1 <= context_num <= len(relevant_chunks):
                chunk = relevant_chunks[context_num - 1]  # Convert 1-based to 0-based index
                source = {
                    'id': f'source_{context_num}',
                    'contextNumber': context_num,
                    'fileName': chunk['metadata']['fileName'],
                    'fileId': chunk['metadata']['fileId'], 
                    'chunkIndex': chunk['metadata']['chunkIndex'],
                    'originalText': chunk['text'],
                    'relevanceScore': chunk['score'],
                    'pageUrl': chunk['metadata'].get('pageUrl'),
                    'cloudinaryUrl': chunk['metadata'].get('cloudinaryUrl'),
                    'thumbnailUrl': chunk['metadata'].get('thumbnailUrl'),
                    'confidencePercentage': f"{chunk['score'] * 100:.1f}"
                }
                
                # Add page and line information only if available (PDF content)
                if chunk['metadata'].get('pageNumber') is not None:
                    source['pageNumber'] = chunk['metadata']['pageNumber']
                
                if chunk['metadata'].get('startLine') is not None:
                    source['startLine'] = chunk['metadata']['startLine']
                    source['endLine'] = chunk['metadata']['endLine']
                    source['lineRange'] = f"Lines {chunk['metadata']['startLine']}-{chunk['metadata']['endLine']}"
                else:
                    source['lineRange'] = 'Full content'
                
                sources.append(source)
        return sources