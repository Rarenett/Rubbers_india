import React, { useState } from "react";
import { Link } from "react-router-dom";
import { markAsRead } from '../../../../../services/EmailService';

const InboxMessage = ({ email, isSelected, onSelect, onStarToggle, isSent }) => {
   const [isExpanded, setIsExpanded] = useState(false);

   // Format timestamp
   const formatTime = (timestamp) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 0) {
         return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
   };

   // Get display name (Sender or Recipient)
   const getDisplayName = () => {
      if (isSent) {
         // Show recipients
         if (!email.recipients_details || email.recipients_details.length === 0) {
            // Fallback if details missing but we have count
            return 'No Recipients';
         }

         const names = email.recipients_details.map(r => {
            if (r.user.first_name && r.user.last_name) return `${r.user.first_name} ${r.user.last_name}`;
            return r.user.email;
         });

         if (names.length === 1) return `To: ${names[0]}`;
         if (names.length === 2) return `To: ${names[0]}, ${names[1]}`;
         return `To: ${names[0]} and ${names.length - 1} others`;
      } else {
         // Show sender
         if (!email.sender) return 'Unknown';
         if (email.sender.first_name && email.sender.last_name) {
            return `${email.sender.first_name} ${email.sender.last_name}`;
         }
         return email.sender.email;
      }
   };

   // Handle email click - mark as read
   const handleEmailClick = async (e) => {
      // If expanding "View More", preventing default navigation might be desired? 
      // User request: "if mail it too long add view more"
      // Usually "view more" navigates. Let's assume standard behavior but visual cue.
      if (!email.is_read) {
         try {
            await markAsRead(email.id);
         } catch (error) {
            console.error('Error marking as read:', error);
         }
      }
   };

   // Toggle expand/collapse
   const handleToggleExpand = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(!isExpanded);

      // Mark as read when expanding
      if (!isExpanded && !email.is_read) {
         handleEmailClick(e);
      }
   };

   // Get preview text with View More/Less
   const renderPreview = () => {
      const subject = email.subject || '(No Subject)';
      const body = email.body || '';

      return (
         <div className={`email-preview ${email.is_read ? 'text-muted' : ''}`} style={{
            maxWidth: '100%',
            overflow: 'hidden'
         }}>
            <div className="email-subject-line mb-1" style={{
               fontWeight: '600',
               color: '#333',
               fontSize: '15px',
               display: 'block'
            }}>
               {subject}
            </div>
            <div
               className="email-body-preview"
               style={{
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: '#666',
                  display: isExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: isExpanded ? 'none' : '3',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
               }}
            >
               {body}
            </div>
            {body.length > 100 && (
               <button
                  onClick={handleToggleExpand}
                  className="btn btn-link text-primary p-0 mt-1 d-inline-block"
                  style={{
                     cursor: 'pointer',
                     fontSize: '12px',
                     textDecoration: 'none',
                     fontWeight: '600'
                  }}
               >
                  {isExpanded ? 'View Less' : 'View More'}
               </button>
            )}
         </div>
      );
   };

   return (
      <div
         className={`message ${!email.is_read ? 'unread' : ''}`}
         style={{
            height: 'auto',
            lineHeight: 'normal',
            padding: '15px 10px',
            display: 'flex',
            alignItems: 'flex-start',
            borderBottom: '1px solid #f0f0f0'
         }}
      >
         {/* Left Side: Checkbox and Star */}
         <div className="d-flex align-items-center me-3" style={{ minWidth: '70px', marginTop: '5px' }}>
            <div className="form-check custom-checkbox me-2">
               <input
                  type="checkbox"
                  className="form-check-input"
                  id={`checkbox-${email.id}`}
                  checked={isSelected}
                  onChange={() => onSelect(email.id)}
               />
               <label className="form-check-label" htmlFor={`checkbox-${email.id}`}></label>
            </div>
            <button
               className="border-0 bg-transparent p-0"
               onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStarToggle(email.id);
               }}
            >
               <i className={`fa fa-star ${email.is_starred ? 'text-warning' : 'text-muted'}`}></i>
            </button>
         </div>

         {/* Middle Side: Sender, Subject, Body */}
         <Link
            to={`/email-read/${email.id}`}
            className="flex-grow-1 text-decoration-none"
            onClick={handleEmailClick}
            style={{ color: 'inherit', display: 'block', minWidth: 0 }}
         >
            <div className="d-flex flex-column" style={{ width: '100%' }}>
               <div className="d-flex align-items-center mb-1 flex-wrap">
                  <span className="me-2" style={{
                     fontWeight: email.is_read ? '600' : '800',
                     fontSize: '15px',
                     color: isSent ? '#666' : '#27ae60'
                  }}>
                     {getDisplayName()}
                  </span>
                  {!email.is_read && (
                     <span className="badge badge-success badge-xs">New</span>
                  )}
               </div>
               {renderPreview()}
            </div>
         </Link>

         {/* Right Side: Date */}
         <div
            className="ms-3 text-end"
            style={{
               minWidth: '80px',
               fontSize: '12px',
               color: '#999',
               marginTop: '5px'
            }}
         >
            {formatTime(email.created_at)}
         </div>
      </div>
   );
};

export default InboxMessage;
