"""Content moderation service for handling harmful/unfriendly content"""
import asyncio
from typing import Dict, Optional, Literal
import logging
import json
from datetime import datetime

logger = logging.getLogger("content_moderation")

class ContentModerationService:
    """Service to handle content moderation actions for the frontend"""
    
    def __init__(self):
        self.moderation_actions = {}  # Store moderation actions by reply_id
        self.websocket_connections = set()  # For real-time updates
        
    async def hide_harmful_content(
        self,
        reply_id: str,
        action_type: Literal["blur", "hide"],
        reason: str,
        sentiment: Literal["harmful", "unfriendly"]
    ) -> Dict[str, any]:
        """
        Hide or blur harmful/unfriendly content in the frontend
        
        Args:
            reply_id: The ID of the reply to moderate
            action_type: Whether to blur or completely hide the content
            reason: Explanation of why the content is being moderated
            sentiment: The sentiment classification (harmful or unfriendly)
            
        Returns:
            Dictionary with the moderation action details
        """
        logger.info(f"Moderating reply {reply_id}: {action_type} due to {sentiment} content")
        
        moderation_action = {
            "reply_id": reply_id,
            "action_type": action_type,
            "reason": reason,
            "sentiment": sentiment,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "applied"
        }
        
        # Store the moderation action
        self.moderation_actions[reply_id] = moderation_action
        
        # Notify frontend through WebSocket if connected
        await self._notify_frontend(moderation_action)
        
        # Log the action for auditing
        logger.info(f"Applied {action_type} to reply {reply_id}: {reason}")
        
        return moderation_action
    
    async def _notify_frontend(self, moderation_action: Dict[str, any]):
        """Send real-time updates to connected frontend clients"""
        if self.websocket_connections:
            message = {
                "type": "content_moderation",
                "action": moderation_action
            }
            
            # Send to all connected WebSocket clients
            disconnected = set()
            for ws in self.websocket_connections:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send WebSocket message: {e}")
                    disconnected.add(ws)
            
            # Remove disconnected clients
            self.websocket_connections -= disconnected
    
    def add_websocket(self, ws):
        """Add a WebSocket connection for real-time updates"""
        self.websocket_connections.add(ws)
        logger.info(f"Added WebSocket connection. Total: {len(self.websocket_connections)}")
    
    def remove_websocket(self, ws):
        """Remove a WebSocket connection"""
        self.websocket_connections.discard(ws)
        logger.info(f"Removed WebSocket connection. Total: {len(self.websocket_connections)}")
    
    def get_moderation_status(self, reply_id: str) -> Optional[Dict[str, any]]:
        """Get the current moderation status for a reply"""
        return self.moderation_actions.get(reply_id)
    
    def get_all_moderation_actions(self) -> Dict[str, Dict[str, any]]:
        """Get all current moderation actions"""
        return self.moderation_actions.copy()
    
    async def batch_moderate(self, actions: list[Dict[str, any]]) -> list[Dict[str, any]]:
        """Apply multiple moderation actions in batch"""
        results = []
        for action in actions:
            result = await self.hide_harmful_content(
                reply_id=action["reply_id"],
                action_type=action["action_type"],
                reason=action["reason"],
                sentiment=action["sentiment"]
            )
            results.append(result)
        return results

# Singleton instance
content_moderation_service = ContentModerationService()