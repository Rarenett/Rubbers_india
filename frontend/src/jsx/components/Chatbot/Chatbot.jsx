import React, { useState, useEffect, useRef } from 'react';
import { getChatHistory, sendMessage } from '../../../services/ChatbotService';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import PerfectScrollbar from 'react-perfect-scrollbar';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, isTyping]);

    // Load chat history when chatbot opens
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            loadChatHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadChatHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const history = await getChatHistory();
            setMessages(Array.isArray(history) ? history : []);
        } catch (err) {
            console.error('Error loading chat history:', err);
            setError('Failed to load chat history');
            setMessages([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (text) => {
        if (!text.trim()) return;

        // Add user message optimistically
        const userMessage = {
            text: text,
            sender: 'user',
            created_at: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsTyping(true);
        setError(null);

        try {
            const response = await sendMessage(text);

            // Add bot response
            if (response.bot_message) {
                setMessages(prev => [...prev, response.bot_message]);
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');

            // Remove the optimistic user message on error
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsTyping(false);
        }
    };

    const toggleChatbot = () => {
        setIsOpen(!isOpen);
    };

    // Inline styles - GUARANTEED TO WORK
    const styles = {
        container: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 99999,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        },
        toggleBtn: {
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
        },
        window: {
            position: 'absolute',
            bottom: '80px',
            right: '0',
            width: '380px',
            height: '600px',
            background: '#1a1a2e',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        },
        header: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        },
        headerContent: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        },
        botAvatar: {
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
        },
        headerInfo: {
            display: 'flex',
            flexDirection: 'column'
        },
        headerTitle: {
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#ffffff'
        },
        status: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.9)',
            marginTop: '2px'
        },
        statusDot: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4ade80'
        },
        closeBtn: {
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
        },
        messagesArea: {
            flex: 1,
            overflow: 'auto',
            background: '#0f0f1e',
            position: 'relative'
        },
        messagesContent: {
            padding: '20px',
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column'
        },
        welcomeContainer: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            textAlign: 'center',
            color: '#a0a0c0',
            padding: '40px'
        },
        welcomeIcon: {
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            color: '#667eea'
        },
        welcomeTitle: {
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: 600,
            margin: '0 0 8px 0'
        },
        welcomeText: {
            margin: 0,
            fontSize: '14px'
        },
        loadingContainer: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: '#a0a0c0'
        },
        loader: {
            width: '40px',
            height: '40px',
            border: '3px solid rgba(102, 126, 234, 0.2)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
        },
        errorContainer: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: '#a0a0c0',
            padding: '40px'
        },
        retryBtn: {
            marginTop: '16px',
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
        },
        typingIndicator: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px 20px'
        },
        typingDot: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#667eea',
            animation: 'typingBounce 1.4s infinite'
        },
        footer: {
            padding: '16px',
            background: '#1a1a2e',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        },
        errorMessage: {
            padding: '8px 12px',
            marginBottom: '12px',
            background: 'rgba(245, 87, 108, 0.1)',
            border: '1px solid rgba(245, 87, 108, 0.3)',
            borderRadius: '8px',
            color: '#f5576c',
            fontSize: '12px',
            textAlign: 'center'
        }
    };

    return (
        <div style={styles.container} className={`chatbot-container ${isOpen ? 'chatbot-open' : ''}`}>
            {/* Floating Chat Button */}
            <button
                style={styles.toggleBtn}
                className="chatbot-toggle-btn"
                onClick={toggleChatbot}
                aria-label="Toggle chatbot"
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                }}
            >
                {isOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                            fill="currentColor"
                        />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM6 9H18V11H6V9ZM14 14H6V12H14V14ZM18 8H6V6H18V8Z"
                            fill="currentColor"
                        />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div style={styles.window} className="chatbot-window">
                    {/* Header */}
                    <div style={styles.header} className="chatbot-header">
                        <div style={styles.headerContent} className="header-content">
                            <div style={styles.botAvatar} className="bot-avatar">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                    <path
                                        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </div>
                            <div style={styles.headerInfo} className="header-info">
                                <h3 style={styles.headerTitle}>AI Assistant</h3>
                                <span style={styles.status} className="status">
                                    <span style={styles.statusDot} className="status-dot"></span>
                                    Online
                                </span>
                            </div>
                        </div>
                        <button
                            style={styles.closeBtn}
                            className="close-btn"
                            onClick={toggleChatbot}
                            aria-label="Close chatbot"
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div style={styles.messagesArea} className="chatbot-messages">
                        <PerfectScrollbar>
                            <div style={styles.messagesContent}>
                                {isLoading ? (
                                    <div style={styles.loadingContainer} className="loading-container">
                                        <div style={styles.loader} className="loader"></div>
                                        <p>Loading chat history...</p>
                                    </div>
                                ) : error && messages.length === 0 ? (
                                    <div style={styles.errorContainer} className="error-container">
                                        <p>{error}</p>
                                        <button 
                                            onClick={loadChatHistory} 
                                            style={styles.retryBtn}
                                            className="retry-btn"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div style={styles.welcomeContainer} className="welcome-container">
                                        <div style={styles.welcomeIcon} className="welcome-icon">
                                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                                                <path
                                                    d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM6 9H18V11H6V9ZM14 14H6V12H14V14ZM18 8H6V6H18V8Z"
                                                    fill="currentColor"
                                                />
                                            </svg>
                                        </div>
                                        <h4 style={styles.welcomeTitle}>Welcome! How can I help you?</h4>
                                        <p style={styles.welcomeText}>Start a conversation by typing a message below.</p>
                                    </div>
                                ) : (
                                    <>
                                        {messages.map((msg, index) => (
                                            <ChatMessage
                                                key={index}
                                                message={msg}
                                                isUser={msg.sender === 'user'}
                                            />
                                        ))}
                                        {isTyping && (
                                            <div style={styles.typingIndicator} className="typing-indicator">
                                                <div style={{...styles.typingDot, animationDelay: '0s'}} className="typing-dot"></div>
                                                <div style={{...styles.typingDot, animationDelay: '0.2s'}} className="typing-dot"></div>
                                                <div style={{...styles.typingDot, animationDelay: '0.4s'}} className="typing-dot"></div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>
                        </PerfectScrollbar>
                    </div>

                    {/* Input Area */}
                    <div style={styles.footer} className="chatbot-footer">
                        {error && messages.length > 0 && (
                            <div style={styles.errorMessage} className="error-message">
                                <span>{error}</span>
                            </div>
                        )}
                        <ChatInput
                            onSendMessage={handleSendMessage}
                            disabled={isTyping || isLoading}
                        />
                    </div>
                </div>
            )}

            {/* Add keyframe animations */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes typingBounce {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.7;
                    }
                    30% {
                        transform: translateY(-10px);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export default Chatbot;