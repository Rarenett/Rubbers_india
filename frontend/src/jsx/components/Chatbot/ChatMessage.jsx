import React from 'react';

const ChatMessage = ({ message, isUser }) => {
 const formatTime = (timestamp) => {
 const date = new Date(timestamp);
 return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 };

 return (
 <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'}`}>
 <div className="message-avatar">
 {isUser ? (
 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
 </svg>
 ) : (
 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
 <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" />
 </svg>
 )}
 </div>
 <div className="message-content">
 <div className="message-bubble">
 <p>{message.text}</p>
 </div>
 <span className="message-time">
 {formatTime(message.created_at)}
 </span>
 </div>
 </div>
 );
};

export default ChatMessage;