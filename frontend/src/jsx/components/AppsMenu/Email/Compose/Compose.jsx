import React, { Fragment, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import DropFile from "./DropFile";
import PageTitle from "../../../../layouts/PageTitle";

import { sendEmail, getInternalUsers } from '../../../../../services/EmailService';

const Compose = () => {
   const navigate = useNavigate();
   const dropdownRef = useRef(null);

   // State
   const [staffUsers, setStaffUsers] = useState([]);
   const [selectedRecipients, setSelectedRecipients] = useState([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [showDropdown, setShowDropdown] = useState(false);
   const [subject, setSubject] = useState('');
   const [body, setBody] = useState('');
   const [files, setFiles] = useState([]);
   const [sending, setSending] = useState(false);
   const [error, setError] = useState(null);
   const [success, setSuccess] = useState(false);

   // Fetch staff users on mount
   useEffect(() => {
      fetchStaffUsers();
   }, []);

   // Close dropdown when clicking outside
   useEffect(() => {
      const handleClickOutside = (event) => {
         if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setShowDropdown(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const fetchStaffUsers = async () => {
      try {
         const users = await getInternalUsers();

         const userDetails = localStorage.getItem('userDetails');
         let currentUserEmail = '';
         if (userDetails) {
            currentUserEmail = JSON.parse(userDetails).user?.email || '';
         }

         // Filter out current user's email just in case the backend didn't
         const filteredStaff = (users || []).filter(
            user => user.email !== currentUserEmail && user.email
         );

         setStaffUsers(filteredStaff);
      } catch (error) {
         console.error('Error fetching staff users:', error);
         setError('Failed to fetch internal users. Check API configuration.');
      }
   };

   // Sequential character matching - matches characters in order
   const matchesSequentially = (text, query) => {
      if (!query) return true;

      const textLower = text.toLowerCase();
      const queryLower = query.toLowerCase();
      let queryIndex = 0;

      for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
         if (textLower[i] === queryLower[queryIndex]) {
            queryIndex++;
         }
      }

      return queryIndex === queryLower.length;
   };

   // Filter users based on search query with sequential matching
   const filteredUsers = staffUsers.filter(user => {
      const query = searchQuery.trim();
      if (!query) return false;

      // Check if already selected
      if (selectedRecipients.find(r => r.email === user.email)) {
         return false;
      }

      // Sequential matching on email, name, first name, or last name
      return (
         matchesSequentially(user.email, query) ||
         matchesSequentially(user.name, query) ||
         (user.first_name && matchesSequentially(user.first_name, query)) ||
         (user.last_name && matchesSequentially(user.last_name, query))
      );
   });

   const handleSelectUser = (user) => {
      setSelectedRecipients(prev => [...prev, user]);
      setSearchQuery('');
      setShowDropdown(false);
   };

   const handleRemoveRecipient = (email) => {
      setSelectedRecipients(prev => prev.filter(r => r.email !== email));
   };

   const handleSend = async () => {
      if (selectedRecipients.length === 0) {
         setError('Please select at least one recipient');
         return;
      }

      if (!subject && !body) {
         setError('Please enter a subject or message');
         return;
      }

      try {
         setSending(true);
         setError(null);

         await sendEmail({
            recipient_emails: selectedRecipients.map(r => r.email),
            subject: subject,
            body: body,
            files: files
         });

         setSuccess(true);
         setTimeout(() => {
            navigate('/email-inbox');
         }, 1500);
      } catch (error) {
         console.error('Error sending email:', error);
         setError('Failed to send email. Please try again.');
      } finally {
         setSending(false);
      }
   };

   const handleDiscard = () => {
      setSelectedRecipients([]);
      setSearchQuery('');
      setSubject('');
      setBody('');
      setFiles([]);
      setError(null);
      setSuccess(false);
      navigate('/email-inbox');
   };

   return (
      <Fragment>
         <PageTitle activeMenu="Compose" motherMenu="Email" />
         <div className="row">
            <div className="col-lg-12">
               <div className="card">
                  <div className="card-body">
                     <div className="row">
                        <div className="col-xl-3 col-xxl-4">
                           <div className="email-left-box">
                              <div className="p-0">
                                 <Link
                                    to="/email-compose"
                                    className="btn btn-primary btn-block"
                                 >
                                    Compose
                                 </Link>
                              </div>
                              <div className="mail-list rounded  mt-4">
                                 <Link
                                    to="/email-inbox"
                                    className="list-group-item"
                                 >
                                    <i className="fa fa-inbox font-18 align-middle me-2"></i>
                                    Inbox
                                 </Link>
                                 <Link
                                    to="/email-inbox"
                                    className="list-group-item"
                                 >
                                    <i className="fa fa-paper-plane font-18 align-middle me-2"></i>
                                    Sent
                                 </Link>
                                 <Link
                                    to="/email-inbox"
                                    className="list-group-item"
                                 >
                                    <i className="fas fa-star font-18 align-middle me-2"></i>
                                    Starred
                                 </Link>
                                 <Link
                                    to="/email-inbox"
                                    className="list-group-item"
                                 >
                                    <i className="fa fa-trash font-18 align-middle me-2"></i>
                                    Trash
                                 </Link>
                              </div>
                           </div>
                        </div>
                        <div className="col-xl-9 col-xxl-8">
                           <div className="">
                              {error && (
                                 <div className="alert alert-danger alert-dismissible fade show">
                                    {error}
                                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                                 </div>
                              )}
                              {success && (
                                 <div className="alert alert-success">
                                    Email sent successfully! Redirecting to inbox...
                                 </div>
                              )}

                              <div className="compose-content">
                                 <div className="form-group">
                                    <label className="text-label">To:</label>

                                    {/* Selected Recipients Tags */}
                                    <div className="mb-2">
                                       {selectedRecipients.map((recipient) => (
                                          <span key={recipient.email} className="badge badge-primary me-2 mb-2" style={{ fontSize: '14px', padding: '8px 12px' }}>
                                             {recipient.name}
                                             <button
                                                type="button"
                                                className="btn-close btn-close-white ms-2"
                                                style={{ fontSize: '10px' }}
                                                onClick={() => handleRemoveRecipient(recipient.email)}
                                                aria-label="Remove"
                                             ></button>
                                          </span>
                                       ))}
                                    </div>

                                    {/* Searchable Dropdown */}
                                    <div className="position-relative" ref={dropdownRef}>
                                       <input
                                          type="text"
                                          className="form-control bg-transparent"
                                          placeholder="Type to search staff users..."
                                          value={searchQuery}
                                          onChange={(e) => {
                                             setSearchQuery(e.target.value);
                                             setShowDropdown(true);
                                          }}
                                          onFocus={() => setShowDropdown(true)}
                                       />

                                       {showDropdown && searchQuery && filteredUsers.length > 0 && (
                                          <div
                                             className="position-absolute w-100 border rounded bg-white shadow-sm mt-1"
                                             style={{ maxHeight: '250px', overflowY: 'auto', zIndex: 1000 }}
                                          >
                                             {filteredUsers.map((user) => (
                                                <div
                                                   key={user.id}
                                                   className="p-2 cursor-pointer"
                                                   style={{ cursor: 'pointer' }}
                                                   onClick={() => handleSelectUser(user)}
                                                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                   <strong>{user.name}</strong>
                                                   <br />
                                                   <small className="text-muted">{user.email}</small>
                                                </div>
                                             ))}
                                          </div>
                                       )}

                                       {showDropdown && searchQuery && filteredUsers.length === 0 && (
                                          <div
                                             className="position-absolute w-100 border rounded bg-white shadow-sm mt-1 p-3"
                                             style={{ zIndex: 1000 }}
                                          >
                                             <small className="text-muted">No users found</small>
                                          </div>
                                       )}
                                    </div>

                                    {selectedRecipients.length > 0 && (
                                       <small className="text-muted mt-1 d-block">
                                          {selectedRecipients.length} recipient(s) selected
                                       </small>
                                    )}
                                 </div>

                                 <div className="form-group">
                                    <input
                                       type="text"
                                       className="form-control bg-transparent"
                                       placeholder="Subject:"
                                       value={subject}
                                       onChange={(e) => setSubject(e.target.value)}
                                    />
                                 </div>
                                 <div className="form-group">
                                    <textarea
                                       id="email-compose-editor"
                                       className="textarea_editor form-control bg-transparent no-capitalize"
                                       rows="8"
                                       placeholder="Enter text ..."
                                       value={body}
                                       onChange={(e) => {
                                          const val = e.target.value;
                                          const sentenceCased = val.replace(/(^|[.?!]\s+|\n+)([a-z])/g, (match, separator, letter) => {
                                             return separator + letter.toUpperCase();
                                          });
                                          setBody(sentenceCased);
                                       }}
                                    ></textarea>
                                 </div>
                                 <h5 className="mb-4">
                                    <i className="fa fa-paperclip"></i> Attachment
                                 </h5>
                                 <DropFile onFilesChange={setFiles} />
                              </div>
                              <div className="text-start mt-4 mb-5">
                                 <button
                                    className="btn btn-primary btn-sl-sm me-2"
                                    type="button"
                                    onClick={handleSend}
                                    disabled={sending}
                                 >
                                    <span className="me-2">
                                       <i className="fa fa-paper-plane"></i>
                                    </span>
                                    {sending ? 'Sending...' : 'Send'}
                                 </button>
                                 <button
                                    className="btn btn-danger light btn-sl-sm"
                                    type="button"
                                    onClick={handleDiscard}
                                    disabled={sending}
                                 >
                                    <span className="me-2">
                                       <i
                                          className="fa fa-times"
                                          aria-hidden="true"
                                       ></i>
                                    </span>
                                    Discard
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </Fragment>
   );
};

export default Compose;
