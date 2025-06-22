export interface Author {
  name: string;
  avatar: string;
  verified?: boolean;
}

export interface Reply {
  id: string;
  type: 'text' | 'image' | 'gif';
  content: string;
  media_url?: string;
  author: Author;
  language: string;
  hidden: boolean;
}

export interface Post {
  id: string;
  type: 'text' | 'image';
  content: string;
  image_url?: string;
  author: Author;
  timestamp: string;
  reactions?: Record<string, number>;
  total_replies?: number;
  replies: Reply[];
}