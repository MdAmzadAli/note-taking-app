
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
            print(f'🤖 Starting structured 3-step LLM flow for: "{query}"')

            # Search for relevant chunks
            is_workspace_query = workspace_id and file_ids and len(file_ids) > 1
            relevant_chunks = await self.search_service.search_relevant_chunks(
                query,
                file_ids,
                workspace_id,
                12 if is_workspace_query else 6
            )

            if not relevant_chunks:
                return {
                    'answer': "I couldn't find relevant information in the uploaded documents to answer your question.",
                    'sources': [],
                    'confidence': 0
                }

            # Step 0: Query recognition and refinement
            step0_result = await self.step0_query_recognition(query, relevant_chunks)
            
            print(f'📊 Step 0 Result: Type={step0_result["queryType"]}, Refined="{step0_result["refinedQuery"]}"')

            # Route to appropriate processing based on query type
            if step0_result['queryType'] == 'computational':
                return await self.process_computational_query(step0_result['refinedQuery'], query, relevant_chunks)
            else:
                return await self.process_factual_query(step0_result['refinedQuery'], query, relevant_chunks)

        except Exception as error:
            print(f'❌ Structured answer generation failed: {error}')
            raise error

    async def step0_query_recognition(self, user_query: str, relevant_chunks: List[Dict]) -> Dict[str, Any]:
        print('🔍 Step 0: Query recognition and refinement...')

        if not self.embedding_service.genai_chat:
            raise Exception("Google GenAI Chat client not initialized")

        # Analyze document context for better query understanding
        document_types = list(set(chunk['metadata']['fileName'] for chunk in relevant_chunks))
        has_table_content = any(chunk['metadata'].get('hasTableContent', False) for chunk in relevant_chunks)
        has_financial_data = any(chunk['metadata'].get('hasFinancialData', False) for chunk in relevant_chunks)

        context_info = f"Documents: {', '.join(document_types)}. Contains tables: {has_table_content}. Contains financial data: {has_financial_data}."

        recognition_prompt = f"""You are a query analysis expert. Analyze the user query and document context to determine query type and refine it.

USER QUERY: {user_query}
DOCUMENT CONTEXT: {context_info}

TASK:
1. Determine if this is a COMPUTATIONAL or FACTUAL query
2. Generate a refined query that makes the intent clearer for multi-document processing

COMPUTATIONAL queries involve:
- Mathematical calculations, sums, totals, averages
- Financial analysis, cost calculations, budget analysis
- Comparisons with numeric results
- Data aggregation across multiple sources
- Quantitative analysis

FACTUAL queries involve:
- Information retrieval, definitions, explanations
- Qualitative descriptions, processes, methods
- Historical facts, dates, events
- Non-numeric comparisons
- General knowledge questions

Return ONLY this JSON format:
{{
  "queryType": "computational" | "factual",
  "refinedQuery": "Enhanced query that clarifies intent and multi-document context",
  "reasoning": "Brief explanation of classification"
}}"""

        try:
            response = await asyncio.to_thread(
                self.embedding_service.genai_chat.generate_content,
                recognition_prompt,
                generation_config={
                    'temperature': 0.1,
                    'top_p': 0.8,
                    'max_output_tokens': 512,
                }
            )

            response_text = response.text
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            
            if json_match:
                result = json.loads(json_match.group())
                print(f'✅ Step 0: {result["queryType"]} query identified - {result["reasoning"]}')
                return result

        except Exception as parse_error:
            print(f'⚠️ Step 0: JSON parsing failed, using fallback classification')

        # Fallback classification based on keywords
        computational_keywords = [
            'calculate', 'sum', 'total', 'cost', 'price', 'amount', 'average', 'compare',
            'analysis', 'budget', 'expense', 'revenue', 'profit', 'loss', 'how much',
            'how many', 'count', 'percentage', 'ratio', 'difference'
        ]

        is_computational = any(keyword in user_query.lower() for keyword in computational_keywords)

        return {
            'queryType': 'computational' if is_computational else 'factual',
            'refinedQuery': user_query,
            'reasoning': 'Fallback keyword-based classification'
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
            response = await asyncio.to_thread(
                self.embedding_service.genai_chat.generate_content,
                structuring_prompt,
                generation_config={
                    'temperature': 0.1,
                    'top_p': 0.8,
                    'max_output_tokens': 4096,
                }
            )

            response_text = response.text
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            
            if json_match:
                structured_data = json.loads(json_match.group())
                print(f'✅ Step 1: Extracted {structured_data.get("summary", {}).get("totalValues", 0)} values from {structured_data.get("summary", {}).get("totalContexts", 0)} contexts')
                return structured_data

        except Exception as parse_error:
            print(f'⚠️ Step 1: JSON parsing failed, using fallback structure')

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

        response = await asyncio.to_thread(
            self.embedding_service.genai_chat.generate_content,
            computational_prompt,
            generation_config={
                'temperature': 0.1,
                'top_p': 0.8,
                'max_output_tokens': 2048,
            }
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
7. Reference context numbers when citing information (e.g., [Context 1])
8. If multiple documents provide different perspectives, present them clearly

CRITICAL: After your answer, identify which contexts you actually used:

---
CONTEXTS_USED: [list only the context numbers (e.g., "1,3,5") that you referenced in your answer]

ANSWER:"""

        response = await asyncio.to_thread(
            self.embedding_service.genai_chat.generate_content,
            factual_prompt,
            generation_config={
                'temperature': 0.3,
                'top_p': 0.8,
                'max_output_tokens': 2048,
            }
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

        # Prepare sources based on used contexts
        filtered_chunks = [relevant_chunks[idx] for idx in used_context_indices]
        sources = []
        for index, chunk in enumerate(filtered_chunks):
            source = {
                'id': f'source_{index + 1}',
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
