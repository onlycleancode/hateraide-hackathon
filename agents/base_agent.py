from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from services.llm_client import llama_client

class BaseAgent(ABC):
    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt
        self.tools = []

    def add_tool(self, tool_definition: Dict[str, Any]):
        self.tools.append(tool_definition)

    async def execute(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_input}
        ]
        
        if context:
            context_msg = f"Context: {context}"
            messages.insert(1, {"role": "system", "content": context_msg})

        tools = self.tools if self.tools else None
        
        result = await llama_client.chat_completion(
            messages=messages,
            tools=tools
        )

        if result["tool_calls"]:
            for tool_call in result["tool_calls"]:
                tool_result = await self.handle_tool_call(tool_call)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(tool_result)
                })
            
            final_result = await llama_client.chat_completion(messages=messages)
            return final_result
        
        return result

    @abstractmethod
    async def handle_tool_call(self, tool_call) -> Any:
        pass