import React, { useState, useRef, useEffect } from 'react';

const ChatInput = ({ onSendMessage, disabled = false }) => {
 const [inputValue, setInputValue] = useState('');
 const textareaRef = useRef(null);

 // Auto-resize textarea
 useEffect(() => {
 if (textareaRef.current) {
 textareaRef.current.style.height = 'auto';
 textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
 }
 }, [inputValue]);

 const handleSubmit = () => {
 if (inputValue.trim() && !disabled) {
 onSendMessage(inputValue.trim());
 setInputValue('');
 
 // Reset textarea height
 if (textareaRef.current) {
 textareaRef.current.style.height = 'auto';
 }
 }
 };

 const handleKeyPress = (e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSubmit();
 }
 };

 return (
 <div className="chat-input-container">
 <div className="input-wrapper">
 <textarea
 ref={textareaRef}
 className="chat-input"
 placeholder="Type your message..."
 value={inputValue}
 onChange={(e) => setInputValue(e.target.value)}
 onKeyPress={handleKeyPress}
 disabled={disabled}
 rows="1"
 />
 <button
 className="send-button"
 onClick={handleSubmit}
 disabled={disabled || !inputValue.trim()}
 aria-label="Send message"
 >
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
 />
 </svg>
 </button>
 </div>
 </div>
 );
};

export default ChatInput;