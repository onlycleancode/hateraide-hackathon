import os
import base64
import asyncio
import aiohttp
from openai import OpenAI
from typing import Dict, List, Any, Optional, Union
from dotenv import load_dotenv
load_dotenv()

class LlamaClient:
    def __init__(self):
        api_key = os.getenv("LLAMA_API_KEY")
        if not api_key:
            # Don't initialize client if no API key - will be handled at runtime
            self.client = None
        else:
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://api.llama.com/compat/v1/"
            )
        self.default_model = "Llama-4-Scout-17B-16E-Instruct-FP8"
        
        # Add HTTP session for connection pooling and better performance
        self._http_session = None
        self._semaphore = asyncio.Semaphore(15)  # Limit concurrent requests
    
    async def _get_http_session(self):
        """Get or create HTTP session with connection pooling"""
        if self._http_session is None or self._http_session.closed:
            connector = aiohttp.TCPConnector(
                limit=25,  # Total connection pool size
                limit_per_host=15,  # Per-host connection limit
                ttl_dns_cache=300,  # DNS cache TTL
                use_dns_cache=True,
                keepalive_timeout=30,
                enable_cleanup_closed=True
            )
            timeout = aiohttp.ClientTimeout(total=60, connect=10)
            self._http_session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )
        return self._http_session
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._http_session and not self._http_session.closed:
            await self._http_session.close()

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        if not self.client:
            raise Exception("LLAMA_API_KEY not set in environment variables")
        
        try:
            completion = self.client.chat.completions.create(
                model=model or self.default_model,
                messages=messages,
                tools=tools,
                temperature=temperature
            )
            return {
                "content": completion.choices[0].message.content,
                "tool_calls": completion.choices[0].message.tool_calls,
                "usage": completion.usage
            }
        except Exception as e:
            raise Exception(f"LLM API error: {str(e)}")

    async def parse_structured_output(
        self,
        messages: List[Dict[str, Any]],
        response_format: Any,
        model: Optional[str] = None
    ) -> Any:
        if not self.client:
            raise Exception("LLAMA_API_KEY not set in environment variables")
        
        try:
            completion = self.client.beta.chat.completions.parse(
                model=model or self.default_model,
                messages=messages,
                response_format=response_format
            )
            return completion.choices[0].message.parsed
        except Exception as e:
            raise Exception(f"Structured output error: {str(e)}")
    
    async def create_multimodal_message(self, text: str, image_urls: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Create a multimodal message with text and images for Llama API"""
        content = [{"type": "text", "text": text}]
        
        if image_urls:
            for image_url in image_urls:
                if self._is_image_url(image_url):
                    # Handle direct image URLs
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": image_url}
                    })
                elif self._is_gif_url(image_url):
                    # Convert GIFs to base64
                    try:
                        base64_data = await self._convert_gif_to_base64(image_url)
                        content.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/gif;base64,{base64_data}"}
                        })
                    except Exception as e:
                        # If conversion fails, add as text description
                        content[0]["text"] += f"\n[GIF content - unable to process: {image_url}]"
        
        return content
    
    def _is_image_url(self, url: str) -> bool:
        """Check if URL is a direct image link"""
        if not url:
            return False
        return any(url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp'])
    
    def _is_gif_url(self, url: str) -> bool:
        """Check if URL is a GIF"""
        if not url:
            return False
        return url.lower().endswith('.gif')
    
    async def _convert_gif_to_base64(self, gif_url: str) -> str:
        """Download and convert GIF to base64 using async HTTP"""
        async with self._semaphore:  # Rate limit GIF downloads
            session = await self._get_http_session()
            async with session.get(gif_url) as response:
                response.raise_for_status()
                content = await response.read()
                return base64.b64encode(content).decode('utf-8')

llama_client = LlamaClient()