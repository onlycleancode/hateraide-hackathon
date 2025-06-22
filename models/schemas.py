from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

class Author(BaseModel):
    name: str
    avatar: str
    verified: bool = False
    important: bool = False

class Reply(BaseModel):
    id: str
    type: Literal["text", "image", "gif"]
    content: str
    media_url: Optional[str] = None
    author: Author
    language: str = "en"
    sentiment: Literal["friendly", "unfriendly", "harmful", "in-jest", "unknown"] = "unknown"
    hidden: bool = False
    timestamp: Optional[str] = None

class Post(BaseModel):
    id: str
    type: Literal["text", "image"]
    content: str
    image_url: Optional[str] = None
    author: Author
    timestamp: str
    replies: List[Reply] = []

class PostAnalysisRequest(BaseModel):
    post: Post

class ReplyAnalysisRequest(BaseModel):
    post: Post
    replies: List[Reply]

class PostAnalysisResult(BaseModel):
    analysis: str
    sentiment: Literal["positive", "negative", "neutral", "mixed"]
    confidence_score: float
    category: Literal["joke", "comedy", "serious", "newsworthy", "personal", "advertisement", "other"]

class ReplyAnalysisResult(BaseModel):
    reply_id: str
    sentiment: Literal["friendly", "unfriendly", "harmful", "in-jest"]
    justification: str
    should_hide: bool
    author_important: bool

class GeneralSentimentResult(BaseModel):
    overall_sentiment: Literal["positive", "negative", "mixed", "neutral"]
    summary: str
    reasons_for_upset: List[str]
    notable_figures: List[str]
    engagement_stats: dict

class NextStepResult(BaseModel):
    important_responders: List[dict]
    recommended_actions: List[str]
    drafted_responses: List[dict]