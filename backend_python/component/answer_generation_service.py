import asyncio
import json
import re
from typing import List, Dict, Any, Optional
# sdsdkj
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
        print(f'📝 Step 2: Unified answer generation with {complexity_result["complexity"]} complexity...')

        if not self.embedding_service.chat_client:
            raise Exception("Google GenAI Chat client not initialized")

        complexity = complexity_result['complexity']
        
        # Select model based on complexity
        if complexity == 'simple':
            model_name = 'gemini-2.0-flash-lite'
            temperature = 0.2
        elif complexity == 'medium':
            model_name = 'gemini-2.5-flash-lite'
            temperature = 0.3
        else:  # complex
            model_name = 'gemini-2.5-flash'
            temperature = 0.1

        print(f'🤖 Using model: {model_name} for {complexity} complexity query')

        # Build enhanced context with numbered references
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

        context = '\n\n'.join(context_parts)

        # Create unified prompt that adapts to complexity and mode
        mode_info = "Single file mode" if is_single_file_mode else "Workspace mode" if is_workspace_mode else "Standard mode"
        
        unified_prompt = f"""You are an expert AI assistant providing accurate, comprehensive answers based on document content. You are operating in {mode_info} and handling a {complexity} complexity query.

USER QUERY: {user_query}
COMPLEXITY LEVEL: {complexity.upper()}
PROCESSING MODE: {mode_info}
COMPLEXITY REASONING: {complexity_result.get('reasoning', 'N/A')}

CONTEXT FROM DOCUMENTS:
{context}

INSTRUCTIONS BASED ON COMPLEXITY:

FOR SIMPLE QUERIES:
- Provide direct, clear answers with minimal elaboration
- Focus on factual information retrieval
- Use straightforward language and structure
- Reference specific contexts when citing information

FOR MEDIUM QUERIES:
- Provide well-structured answers with moderate analysis
- Include comparisons, calculations, or synthesis as needed
- Use **bold text** for important headings and key terms
- Organize information with bullet points or numbered lists
- Show your reasoning process for calculations or comparisons

FOR COMPLEX QUERIES:
- Provide comprehensive, in-depth analysis
- Include multi-step reasoning and sophisticated synthesis
- Create detailed sections with clear organization
- Perform advanced calculations, trend analysis, or strategic reasoning
- Provide recommendations or insights based on deep analysis
- Use multiple formatting elements for clarity

UNIVERSAL REQUIREMENTS:
1. Answer using ONLY the provided context - do not add external information
2. Be precise and accurate in your citations
3. Use **bold text** for important headings, numbers, and key terms
4. Structure your answer appropriately for the complexity level
5. Reference context numbers when citing specific information (e.g., [Context 1,3] or [Context 2])
6. For {mode_info}: {"Focus on individual document analysis" if is_single_file_mode else "Consider cross-document analysis and comparisons" if is_workspace_mode else "Standard document processing"}
7. Handle table data, financial information, and structured content appropriately
8. If multiple documents provide different perspectives, present them clearly

CRITICAL: After your answer, identify which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:"""

        try:
            # Generate response using selected model
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model=model_name,
                contents=[unified_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=temperature,
                    top_p=0.8,
                    max_output_tokens=3072 if complexity == 'complex' else 2048
                )
            )

            full_response = response.text
            print(f'📝 Step 2: Generated response with {model_name}')

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
                print(f'🎯 Step 2: Used {len(used_context_numbers)} contexts: [{", ".join(map(str, used_context_numbers))}]')
            else:
                print('⚠️ Could not extract CONTEXTS_USED, using all contexts')
                used_context_numbers = list(range(1, len(relevant_chunks) + 1))

            # Build sources from used contexts
            sources = self._build_sources_from_context_numbers(relevant_chunks, used_context_numbers)

            # Determine analysis type based on complexity and features
            analysis_type = f"{complexity}-complexity"
            if complexity_result['documentFeatures'].get('hasTableContent', False):
                analysis_type += "-table-aware"
            if complexity_result['documentFeatures'].get('hasFinancialData', False):
                analysis_type += "-financial"
            if is_workspace_mode:
                analysis_type += "-workspace"
            elif is_single_file_mode:
                analysis_type += "-single-file"

            result = {
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

            print(f'✅ Step 2: Successfully generated {complexity} complexity answer using {model_name}')
            return result

        except Exception as generation_error:
            print(f'❌ Step 2: Answer generation failed: {generation_error}')
            raise generation_error

    async def step0_query_recognition(self, user_query: str, relevant_chunks: List[Dict], 
                                     is_single_file_mode: bool = False, is_workspace_mode: bool = False) -> Dict[str, Any]:
        print(f'🔍 Step 0: Enhanced query recognition and refinement (Single: {is_single_file_mode}, Workspace: {is_workspace_mode})...')

        if not self.embedding_service.chat_client:
            raise Exception("Google GenAI Chat client not initialized")

        # Enhanced document context analysis with mode information
        document_types = list(set(chunk['metadata']['fileName'] for chunk in relevant_chunks))
        has_table_content = any(chunk['metadata'].get('hasTableContent', False) for chunk in relevant_chunks)
        has_json_tables = any(chunk['metadata'].get('has_json_tables', False) for chunk in relevant_chunks)
        has_financial_data = any(chunk['metadata'].get('hasFinancialData', False) for chunk in relevant_chunks)
        has_structured_tables = any(chunk.get('structured_tables') for chunk in relevant_chunks)

        # Count table chunks and their types
        table_chunks = [chunk for chunk in relevant_chunks if chunk['metadata'].get('hasTableContent', False)]
        table_count = len(table_chunks)

        # Analyze table metadata for better classification
        table_headers = []
        table_currencies = []
        for chunk in table_chunks:
            numeric_metadata = chunk['metadata'].get('numeric_metadata', {})
            if numeric_metadata:
                table_headers.extend(numeric_metadata.get('table_context_headings', []))
                table_currencies.extend(numeric_metadata.get('currencies', []))

        mode_info = "Single file mode" if is_single_file_mode else "Workspace mode" if is_workspace_mode else "Standard mode"
        context_info = f"Mode: {mode_info}. Documents: {', '.join(document_types)}. Tables: {table_count} chunks, JSON tables: {has_json_tables}, Structured tables: {has_structured_tables}. Financial data: {has_financial_data}. Table contexts: {table_headers[:3]}."

        recognition_prompt = f"""You are an advanced query analysis expert. Analyze the user query and document context to determine the specific task type and processing strategy.

USER QUERY: {user_query}
DOCUMENT CONTEXT: {context_info}

TASK TYPES TO CLASSIFY:

1. **factual-text**: Pure information retrieval from text
   - Definitions, explanations, descriptions
   - Historical facts, processes, methods
   - Qualitative information without tables
   - Example: "What is machine learning?"

2. **factual-table**: Information retrieval specifically from tabular data
   - Looking up values in tables
   - Finding specific entries or records
   - Listing items from structured data
   - Example: "What cities are listed in the investment table?"

3. **computational**: Mathematical analysis and calculations
   - Sums, averages, totals, percentages
   - Financial calculations and analysis
   - Mathematical comparisons (highest, lowest, difference)
   - Example: "What is the total investment amount?"

4. **mixed**: Combines table retrieval + computational reasoning
   - Questions that need both table data AND calculations
   - Comparative analysis across table data
   - Ranking or sorting based on calculations
   - Example: "Which of these 5 cities has the highest investment?" (needs table data + comparison)

CLASSIFICATION RULES:
- Single file mode: Focus on individual document analysis
- Workspace mode: Consider cross-document analysis and comparison
- If query asks for specific table data without calculation → factual-table
- If query asks "which is highest/lowest/best" from table data → mixed (needs retrieval + comparison)
- If query asks for calculations on known values → computational  
- If query is about general information without tables → factual-text
- If context has {table_count} table chunks and query mentions ranking/comparison → likely mixed
- In workspace mode, comparative queries across documents default to mixed type

Return ONLY this JSON format:
{{
  "queryType": "factual-text" | "factual-table" | "computational" | "mixed",
  "refinedQuery": "Enhanced query that clarifies intent and multi-document context",
  "reasoning": "Brief explanation of classification",
  "retrievalStrategy": "semantic" | "table-focused" | "hybrid",
  "requiresTableData": true | false,
  "requiresCalculation": true | false
}}"""

        try:
            # Use correct Google GenAI SDK structure with cheapest model for Step 0
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model='gemini-1.5-flash-8b',  # Cheapest model for Step 0
                contents=[recognition_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.8,
                    max_output_tokens=512
                )
            )

            response_text = response.text
            print(f'📊 Step 0: Raw response: {response_text}')
            json_match = re.search(r'\{[\s\S]*\}', response_text)

            if json_match:
                result = json.loads(json_match.group())
                print(f'✅ Step 0: {result["queryType"]} query identified - {result["reasoning"]}')
                return result

        except Exception as parse_error:
            print(f'⚠️ Step 0: JSON parsing failed, using fallback classification: {parse_error}')

        # Enhanced fallback classification based on keywords
        query_lower = user_query.lower()

        computational_keywords = [
            'calculate', 'sum', 'total', 'average', 'percentage', 'ratio', 'difference',
            'how much', 'cost analysis', 'budget calculation'
        ]

        table_keywords = [
            'table', 'list', 'show all', 'what are', 'which ones', 'entries', 'records'
        ]

        comparison_keywords = [
            'highest', 'lowest', 'best', 'worst', 'top', 'bottom', 'most', 'least',
            'compare', 'rank', 'ranking', 'which is', 'who has'
        ]

        # Determine query type based on keyword analysis
        has_computation = any(keyword in query_lower for keyword in computational_keywords)
        has_table_focus = any(keyword in query_lower for keyword in table_keywords)
        has_comparison = any(keyword in query_lower for keyword in comparison_keywords)

        # Classification logic with mode awareness
        if has_comparison and (has_table_content or has_table_focus):
            query_type = 'mixed'  # Needs table data + comparison
        elif has_computation and not has_table_focus:
            query_type = 'computational'
        elif has_table_focus or (has_table_content and not has_computation):
            query_type = 'factual-table'
        elif is_workspace_mode and has_comparison:
            query_type = 'mixed'  # Workspace comparisons often need mixed processing
        else:
            query_type = 'factual-text'

        return {
            'queryType': query_type,
            'refinedQuery': user_query,
            'reasoning': f'Fallback classification ({mode_info}): computation={has_computation}, table={has_table_focus}, comparison={has_comparison}',
            'retrievalStrategy': 'hybrid' if query_type == 'mixed' else 'semantic',
            'requiresTableData': query_type in ['factual-table', 'mixed'],
            'requiresCalculation': query_type in ['computational', 'mixed'],
            'processingMode': mode_info
        }

    async def process_computational_query(self, refined_query: str, original_query: str, 
                                        relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('🧮 Processing computational query through Step 1 → Step 2')

        # Step 1: Convert context to structured JSON using cheap model
        structured_data = await self.step1_context_to_json(refined_query, relevant_chunks)

        # Step 2: Process structured data with main model
        return await self.step2_computational_processing(refined_query, original_query, structured_data, relevant_chunks)

    async def process_factual_query(self, refined_query: str, original_query: str, 
                                   relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('📚 Processing factual query directly with Step 2')

        return await self.step2_factual_processing(refined_query, original_query, relevant_chunks)

    async def process_factual_table_query(self, refined_query: str, original_query: str, 
                                        relevant_chunks: List[Dict], step0_result: Dict) -> Dict[str, Any]:
        print('📊 Processing factual-table query with structured table focus')

        # Filter and prioritize table chunks
        table_chunks = self._prioritize_table_chunks(relevant_chunks)

        return await self.step2_factual_table_processing(refined_query, original_query, table_chunks)

    async def process_mixed_query(self, refined_query: str, original_query: str, 
                                relevant_chunks: List[Dict], step0_result: Dict) -> Dict[str, Any]:
        print('🔀 Processing mixed query with table retrieval + computational reasoning')

        # Step 1: Extract structured table data for computational analysis
        table_chunks = self._prioritize_table_chunks(relevant_chunks)
        structured_data = await self.step1_context_to_json(refined_query, table_chunks)

        # Step 2: Process with mixed reasoning (table facts + computation)
        return await self.step2_mixed_processing(refined_query, original_query, structured_data, relevant_chunks)

    def _prioritize_table_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """Prioritize and filter chunks with table content"""
        # Separate table and non-table chunks
        table_chunks = []
        text_chunks = []

        for chunk in chunks:
            metadata = chunk.get('metadata', {})
            if (metadata.get('hasTableContent', False) or 
                metadata.get('has_json_tables', False) or 
                chunk.get('structured_tables')):
                table_chunks.append(chunk)
            else:
                text_chunks.append(chunk)

        # Prioritize table chunks but include some text for context
        prioritized = table_chunks + text_chunks[:2]  # Include top 2 text chunks for context

        print(f'🎯 Prioritized {len(table_chunks)} table chunks + {min(2, len(text_chunks))} context chunks')
        return prioritized[:12]  # Limit total chunks

    async def step1_context_to_json(self, refined_query: str, relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('📊 Step 1: Converting context to structured JSON...')

        numbered_contexts = []
        for index, chunk in enumerate(relevant_chunks):
            location_info = ''

            # Build location info only if page/line data exists
            if chunk['metadata'].get('pageNumber') is not None:
                location_info = f"Page {chunk['metadata']['pageNumber']}"
                if chunk['metadata'].get('startLine') is not None:
                    location_info += f", Lines {chunk['metadata']['startLine']}-{chunk['metadata']['endLine']}"
            else:
                location_info = 'Content'

            numbered_contexts.append(f"[Context {index + 1} - Doc: {chunk['metadata']['fileName']} | {location_info}]: {chunk['text']}")

        structuring_prompt = f"""You are a data extraction expert. Convert the provided context into a well-structured JSON format for computational analysis.

USER QUERY: {refined_query}

CONTEXTS:
{chr(10).join(numbered_contexts)}

INSTRUCTIONS:
1. Extract ALL numerical values, currencies, percentages, and quantitative data
2. Preserve context relationships and labels
3. Include metadata like source document, page, and location
4. Maintain original values AND normalized values
5. Include any calculations, formulas, or relationships mentioned
6. Extract categorical data that supports the computation

Return a structured JSON with this format:
{{
  "extractedData": [
    {{
      "contextNumber": 1,
      "sourceDocument": "filename.pdf",
      "pageNumber": 1,
      "values": [
        {{
          "label": "descriptive label",
          "originalValue": "₹1,23,456.78",
          "normalizedValue": 123456.78,
          "currency": "INR",
          "valueType": "currency|percentage|quantity|count",
          "isNegative": false,
          "relationships": ["relates to X", "part of Y total"]
        }}
      ],
      "categories": ["category1", "category2"],
      "calculations": ["any formulas or calculations mentioned"],
      "relevantText": "key text passages for context"
    }}
  ],
  "summary": {{
    "totalContexts": 5,
    "totalValues": 25,
    "currencies": ["INR", "USD"],
    "valueTypes": ["currency", "percentage"],
    "hasComputationalElements": true
  }}
}}"""

        try:
            # Use correct Google GenAI SDK structure with cheap model for Step 1
            response = await asyncio.to_thread(
                self.embedding_service.chat_client.models.generate_content,
                model='gemini-1.5-flash-8b',  # Cheap model for Step 1
                contents=[structuring_prompt],
                config=self.embedding_service.genai_types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.8,
                    max_output_tokens=4096
                )
            )

            response_text = response.text
            json_match = re.search(r'\{[\s\S]*\}', response_text)

            if json_match:
                structured_data = json.loads(json_match.group())
                print(f'✅ Step 1: Extracted {structured_data.get("summary", {}).get("totalValues", 0)} values from {structured_data.get("summary", {}).get("totalContexts", 0)} contexts')
                return structured_data

        except Exception as parse_error:
            print(f'⚠️ Step 1: JSON parsing failed, using fallback structure: {parse_error}')

        # Fallback: create basic structure
        return {
            'extractedData': [
                {
                    'contextNumber': index + 1,
                    'sourceDocument': chunk['metadata']['fileName'],
                    'pageNumber': chunk['metadata'].get('pageNumber'),
                    'values': [],
                    'categories': [],
                    'calculations': [],
                    'relevantText': chunk['text'][:200] + '...' if len(chunk['text']) > 200 else chunk['text']
                }
                for index, chunk in enumerate(relevant_chunks)
            ],
            'summary': {
                'totalContexts': len(relevant_chunks),
                'totalValues': 0,
                'currencies': [],
                'valueTypes': [],
                'hasComputationalElements': False
            }
        }

    async def step2_computational_processing(self, refined_query: str, original_query: str, 
                                           structured_data: Dict, relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('🔢 Step 2: Computational processing with structured data...')

        computational_prompt = f"""You are an expert computational analyst. Perform the requested calculation using the structured data provided.

ORIGINAL USER QUERY: {original_query}
REFINED QUERY: {refined_query}

STRUCTURED DATA:
{json.dumps(structured_data, indent=2)}

INSTRUCTIONS:
1. Use the structured data to perform accurate calculations
2. Standardize all values (convert 1.2k to 1200, 1.2M to 1,200,000, etc.)
3. Handle different currencies appropriately
4. Explain your calculation steps clearly and in easy to understand language with respect to the user's point of view
5. Use **bold text** for important numbers and results
6. Structure your answer with clear sections with one liner summary of answer at top like: "The total cost of bookings is **$12,345.67**
7. Reference specific contexts when citing data

CRITICAL: After your answer, list which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your calculations]

ANSWER:"""

        # Use correct Google GenAI SDK structure with main model for Step 2
        response = await asyncio.to_thread(
            self.embedding_service.chat_client.models.generate_content,
            model='gemini-2.5-flash',  # Main model for Step 2
            contents=[computational_prompt],
            config=self.embedding_service.genai_types.GenerateContentConfig(
                temperature=0.1,
                top_p=0.8,
                max_output_tokens=2048
            )
        )

        full_response = response.text

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
            print(f'🎯 Step 2: Used {len(used_context_numbers)} contexts: [{", ".join(map(str, used_context_numbers))}]')
        else:
            print('⚠️ Could not extract CONTEXTS_USED, using all contexts')
            used_context_numbers = list(range(1, len(relevant_chunks) + 1))

        # Prepare sources based on used contexts
        sources = []
        for context_num in used_context_numbers:
            if 1 <= context_num <= len(relevant_chunks):
                chunk = relevant_chunks[context_num - 1]
                source = {
                    'id': f'source_{context_num}',
                    'contextNumber': context_num,  # Add explicit context number field
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

        return {
            'answer': answer,
            'sources': sources,
            'confidence': relevant_chunks[0]['score'] if relevant_chunks else 0,
            'analysisType': 'computational-structured',
            'processingStats': {
                'totalContexts': len(relevant_chunks),
                'extractedValues': structured_data.get('summary', {}).get('totalValues', 0),
                'usedContexts': len(used_context_numbers),
                'currencies': structured_data.get('summary', {}).get('currencies', [])
            }
        }

    async def step2_factual_processing(self, refined_query: str, original_query: str, 
                                     relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('📖 Step 2: Factual processing...')

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

            context_parts.append(f"[Context {index + 1} - {chunk['metadata']['fileName']} - {location_info} - Relevance: {confidence}%]: {chunk['text']}")

        context = '\n\n'.join(context_parts)

        factual_prompt = f"""You are an expert AI assistant providing accurate, detailed answers based on document content.

ORIGINAL USER QUERY: {original_query}
REFINED QUERY: {refined_query}

CONTEXT FROM DOCUMENTS:
{context}

INSTRUCTIONS:
1. Answer the refined query using the provided context
2. Be comprehensive and well-structured with proper formatting
3. Use **bold text** for important headings and key terms
4. Use bullet points (•) or numbered lists for multiple items
5. Structure complex answers with clear sections
6. Include specific details and examples when relevant
7. Reference context used when citing information and remember to be very precise on context, only give context number of those only which you actually used for generating that statement, and that statement consist of that context (e.g., [Context 1,2,5] or [Context 3])
8. If multiple documents provide different perspectives, present them clearly

CRITICAL: After your answer, identify which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:"""

        # Use correct Google GenAI SDK structure for factual processing
        response = await asyncio.to_thread(
            self.embedding_service.chat_client.models.generate_content,
            model='gemini-2.5-flash-lite',  # Main model for Step 2 factual
            contents=[factual_prompt],
            config=self.embedding_service.genai_types.GenerateContentConfig(
                temperature=0.3,
                top_p=0.8,
                max_output_tokens=2048
            )
        )

        full_response = response.text

        # Extract used contexts and clean answer
        answer = full_response
        used_context_indices = []

        contexts_used_match = re.search(r'CONTEXTS_USED:\s*\[(.*?)\]', full_response)
        if contexts_used_match:
            contexts_used_str = contexts_used_match.group(1)
            used_context_indices = [
                int(s.strip()) - 1 for s in contexts_used_str.split(',') 
                if s.strip().isdigit() and 1 <= int(s.strip()) <= len(relevant_chunks)
            ]

            answer = re.sub(r'---\s*CONTEXTS_USED:.*$', '', full_response, flags=re.DOTALL).strip()
            print(f'🎯 Step 2: Used {len(used_context_indices)} contexts: [{", ".join(str(i + 1) for i in used_context_indices)}]')
        else:
            print('⚠️ Could not extract CONTEXTS_USED, using all contexts')
            used_context_indices = list(range(len(relevant_chunks)))

        # Prepare sources based on used contexts - preserve original context numbers
        sources = []
        for context_idx in used_context_indices:
            if 0 <= context_idx < len(relevant_chunks):
                chunk = relevant_chunks[context_idx]
                context_num = context_idx + 1  # Convert 0-based index to 1-based context number
                source = {
                    'id': f'source_{context_num}',
                    'contextNumber': context_num,  # Add explicit context number field
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

        return {
            'answer': answer,
            'sources': sources,
            'confidence': relevant_chunks[0]['score'] if relevant_chunks else 0,
            'analysisType': 'factual-direct'
        }

    async def step2_factual_table_processing(self, refined_query: str, original_query: str, 
                                           relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('📊 Step 2: Factual table processing with structured data focus...')

        # Build enhanced context highlighting table structure
        context_parts = []
        for index, chunk in enumerate(relevant_chunks):
            confidence = f"{chunk['score'] * 100:.1f}"
            location_info = ''

            if chunk['metadata'].get('pageNumber') is not None:
                location_info = f"Page {chunk['metadata']['pageNumber']}"
                if chunk['metadata'].get('startLine') is not None:
                    location_info += f", Lines {chunk['metadata']['startLine']}-{chunk['metadata']['endLine']}"
            else:
                location_info = 'Content'

            # Highlight if this chunk contains structured table data
            table_info = ""
            if chunk.get('structured_tables'):
                table_count = len(chunk['structured_tables'])
                table_info = f" [STRUCTURED TABLES: {table_count}]"
            elif chunk['metadata'].get('hasTableContent', False):
                table_info = " [TABLE CONTENT]"

            context_parts.append(f"[Context {index + 1} - {chunk['metadata']['fileName']} - {location_info}{table_info} - Relevance: {confidence}%]: {chunk['text']}")

        context = '\n\n'.join(context_parts)

        factual_table_prompt = f"""You are an expert at extracting information from structured data and tables. Answer the query using the table data and structured information provided.

ORIGINAL USER QUERY: {original_query}
REFINED QUERY: {refined_query}

CONTEXT WITH STRUCTURED TABLE DATA:
{context}

INSTRUCTIONS FOR TABLE-FOCUSED QUERIES:
1. Focus primarily on structured table data and tabular information
2. Extract specific values, entries, or records as requested
3. Present table data in a clear, organized format
4. Use **bold text** for important table headers and key values
5. Create lists or structured output when appropriate
6. Reference specific table contexts when citing data
7. If multiple tables exist, clearly distinguish between them
8. Maintain table structure and relationships in your answer

CRITICAL: After your answer, identify which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:"""

        response = await asyncio.to_thread(
            self.embedding_service.chat_client.models.generate_content,
            model='gemini-2.5-flash-lite',
            contents=[factual_table_prompt],
            config=self.embedding_service.genai_types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.8,
                max_output_tokens=2048
            )
        )

        full_response = response.text
        answer, used_context_indices = self._extract_contexts_and_clean_answer(full_response, relevant_chunks)
        sources = self._build_sources_from_contexts(relevant_chunks, used_context_indices)

        return {
            'answer': answer,
            'sources': sources,
            'confidence': relevant_chunks[0]['score'] if relevant_chunks else 0,
            'analysisType': 'factual-table-focused'
        }

    async def step2_mixed_processing(self, refined_query: str, original_query: str, 
                                   structured_data: Dict, relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('🔀 Step 2: Mixed processing with table facts + computational reasoning...')

        mixed_prompt = f"""You are an expert analyst capable of both information retrieval and computational reasoning. Process the query using both factual table data and computational analysis.

ORIGINAL USER QUERY: {original_query}
REFINED QUERY: {refined_query}

STRUCTURED TABLE DATA:
{json.dumps(structured_data, indent=2)}

INSTRUCTIONS FOR MIXED QUERIES:
1. First, identify and extract the relevant table data/facts needed
2. Then, perform any necessary calculations or comparisons
3. For ranking/comparison questions: extract values then compare them
4. Use **bold text** for important numbers, rankings, and results
5. Structure your answer with clear sections:
   - Summary of findings at the top
   - Table data extracted
   - Calculations performed (if any)
   - Final conclusion/answer
6. Reference specific contexts when citing data
7. Handle multiple tables by clearly distinguishing sources

EXAMPLE STRUCTURE for "Which city has highest investment?":
**Answer: City X has the highest investment with $Y million**

**Table Data Found:**
- City A: $X million
- City B: $Y million
- City C: $Z million

**Analysis:** Comparing the investment amounts, City B leads with $Y million, followed by...

CRITICAL: After your answer, list which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced]

ANSWER:"""

        response = await asyncio.to_thread(
            self.embedding_service.chat_client.models.generate_content,
            model='gemini-2.5-flash',
            contents=[mixed_prompt],
            config=self.embedding_service.genai_types.GenerateContentConfig(
                temperature=0.1,
                top_p=0.8,
                max_output_tokens=2048
            )
        )

        full_response = response.text
        answer, used_context_numbers = self._extract_contexts_and_clean_answer(full_response, relevant_chunks, return_numbers=True)
        sources = self._build_sources_from_context_numbers(relevant_chunks, used_context_numbers)

        return {
            'answer': answer,
            'sources': sources,
            'confidence': relevant_chunks[0]['score'] if relevant_chunks else 0,
            'analysisType': 'mixed-table-computational',
            'processingStats': {
                'totalContexts': len(relevant_chunks),
                'extractedValues': structured_data.get('summary', {}).get('totalValues', 0),
                'usedContexts': len(used_context_numbers),
                'currencies': structured_data.get('summary', {}).get('currencies', []),
                'tableDataProcessed': True,
                'computationalAnalysis': True
            }
        }

    def _extract_contexts_and_clean_answer(self, full_response: str, relevant_chunks: List[Dict], return_numbers: bool = False):
        """Extract used contexts and clean the answer text"""
        answer = full_response
        used_contexts = []

        contexts_used_match = re.search(r'CONTEXTS_USED:\s*\[(.*?)\]', full_response)
        if contexts_used_match:
            contexts_used_str = contexts_used_match.group(1)
            if return_numbers:
                used_contexts = [
                    int(s.strip()) for s in contexts_used_str.split(',') 
                    if s.strip().isdigit() and 1 <= int(s.strip()) <= len(relevant_chunks)
                ]
            else:
                used_contexts = [
                    int(s.strip()) - 1 for s in contexts_used_str.split(',') 
                    if s.strip().isdigit() and 1 <= int(s.strip()) <= len(relevant_chunks)
                ]

            answer = re.sub(r'---\s*CONTEXTS_USED:.*$', '', full_response, flags=re.DOTALL).strip()
            print(f'🎯 Step 2: Used {len(used_contexts)} contexts')
        else:
            print('⚠️ Could not extract CONTEXTS_USED, using all contexts')
            if return_numbers:
                used_contexts = list(range(1, len(relevant_chunks) + 1))
            else:
                used_contexts = list(range(len(relevant_chunks)))

        return answer, used_contexts

    def _build_sources_from_contexts(self, relevant_chunks: List[Dict], used_context_indices: List[int]) -> List[Dict]:
        """Build sources from context indices (0-based)"""
        filtered_chunks = [relevant_chunks[idx] for idx in used_context_indices if 0 <= idx < len(relevant_chunks)]
        return self._build_sources_list(filtered_chunks)

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

    def _build_sources_list(self, chunks: List[Dict]) -> List[Dict]:
        """Build standardized sources list from chunks"""
        sources = []
        for index, chunk in enumerate(chunks):
            source = {
                "chunk_id": chunk.get("chunk_id"), # Changed from payload.get to get directly from chunk
                "file_id": chunk.get("fileId"), # Changed from payload.get to get directly from chunk
                "file_name": chunk.get("fileName"), # Changed from payload.get to get directly from chunk
                "page_number": chunk.get("pageNumber"), # Changed from payload.get to get directly from chunk
                "relevance_score": round(chunk.get('score', 0), 4), # Changed from chunk.score to chunk.get('score', 0)
                "content": chunk.get("text", "")[:200] + "..." if len(chunk.get("text", "")) > 200 else chunk.get("text", "") # Changed from payload.get("content", "") to chunk.get("text", "")
            }

            # Add URLs only if available
            if chunk.get("pageUrl"): # Changed from payload.get("page_url") to chunk.get("pageUrl")
                source["page_url"] = chunk.get("pageUrl") # Changed from payload.get("page_url") to chunk.get("pageUrl")
            if chunk.get("cloudinaryUrl"): # Changed from payload.get("cloudinaryUrl") to chunk.get("cloudinaryUrl")
                source["cloudinaryUrl"] = chunk.get("cloudinaryUrl") # Changed from payload.get("cloudinaryUrl") to chunk.get("cloudinaryUrl")
            if chunk.get("thumbnailUrl"): # Changed from payload.get("thumbnail_url") to chunk.get("thumbnailUrl")
                source["thumbnailUrl"] = chunk.get("thumbnailUrl") # Changed from payload.get("thumbnail_url") to chunk.get("thumbnailUrl")

            # Add page and line information only if available (PDF content)
            if chunk.get('pageNumber') is not None:
                source['pageNumber'] = chunk['pageNumber']

            if chunk.get('startLine') is not None:
                source['startLine'] = chunk['startLine']
                source['endLine'] = chunk['endLine']
                source['lineRange'] = f"Lines {chunk['startLine']}-{chunk['endLine']}"
            else:
                source['lineRange'] = 'Full content'

            sources.append(source)

        return sources

    # Legacy compatibility methods (kept for backward compatibility)
    def is_financial_query(self, query: str) -> bool:
        financial_keywords = [
            'cost', 'costs', 'price', 'prices', 'amount', 'amounts', 'budget', 'budgets',
            'expense', 'expenses', 'fee', 'fees', 'payment', 'payments', 'total', 'sum',
            'revenue', 'profit', 'loss', 'financial', 'money', 'currency', 'dollar',
            'rupee', 'euro', 'pound', '$', '₹', '€', '£', 'calculate', 'calculation'
        ]

        query_lower = query.lower()
        return any(keyword in query_lower for keyword in financial_keywords)

    def is_complex_query(self, query: str) -> bool:
        complex_indicators = [
            'cost', 'costs', 'price', 'prices', 'total', 'sum', 'calculate', 'calculation',
            'budget', 'expense', 'revenue', 'profit', 'financial',
            'compare', 'comparison', 'analyze', 'analysis', 'evaluate', 'assessment',
            'summary', 'summarize', 'overview', 'breakdown', 'detailed', 'comprehensive',
            'all', 'entire', 'complete', 'overall', 'across', 'throughout',
            'multiple', 'various', 'different', 'each', 'every',
            'what are', 'list all', 'show me', 'find all', 'identify',
            'how many', 'which ones', 'what kind'
        ]

        query_lower = query.lower()
        complex_keyword_count = sum(1 for keyword in complex_indicators if keyword in query_lower)

        return complex_keyword_count >= 2 or len(query) > 100 or self.is_financial_query(query)

    # Legacy methods for backward compatibility
    async def generate_two_step_answer(self, query: str, relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('🔄 Legacy method called, redirecting to structured flow...')
        return await self.generate_answer(query, None, None)

    async def generate_standard_answer(self, query: str, relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('📝 Legacy method called, redirecting to structured flow...')
        return await self.generate_answer(query, None, None)