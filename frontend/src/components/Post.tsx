import React from 'react';
import { Post as PostType } from '../types';
// import Reply from './Reply';

interface PostProps {
  post: PostType;
}

const Post: React.FC<PostProps> = ({ post }) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
      <div className="p-4">
        <div className="flex items-center mb-3">
          <img 
            src={post.author.avatar} 
            alt={post.author.name}
            className="w-10 h-10 rounded-full mr-3"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40x40/9CA3AF/FFFFFF?text=U';
            }}
          />
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center">
              {post.author.name}
              {post.author.verified && (
                <svg className="w-4 h-4 ml-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </h3>
            <p className="text-sm text-gray-500">{formatTimestamp(post.timestamp)}</p>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-gray-800 mb-3">{post.content}</p>
          {post.type === 'image' && post.image_url && (
            <img 
              src={post.image_url} 
              alt="Post content"
              className="rounded-lg max-w-full h-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300/E5E7EB/6B7280?text=Image+Not+Found';
              }}
            />
          )}
        </div>

        <div className="flex items-center space-x-6 text-gray-500 text-sm mb-4">
          <button className="flex items-center space-x-1 hover:text-red-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>Like</span>
          </button>
          <button className="flex items-center space-x-1 hover:text-blue-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Reply</span>
          </button>
        </div>
      </div>

      {post.replies.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="p-4">
            <h4 className="font-semibold text-gray-700 mb-3">
              {post.replies.length} {post.replies.length === 1 ? 'Reply' : 'Replies'}
            </h4>
            <div className="space-y-3">
              {post.replies.map(reply => (
                <div key={reply.id} className="p-2 bg-gray-50 rounded">
                  <strong>{reply.author.name}</strong>: {reply.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;