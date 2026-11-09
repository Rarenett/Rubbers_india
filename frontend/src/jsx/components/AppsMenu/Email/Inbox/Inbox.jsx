import React, { Fragment, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import InboxMessage from './InboxMessage';
import { Dropdown } from 'react-bootstrap';
import PageTitle from '../../../../layouts/PageTitle';
import { getEmails, getFolderCounts, moveToTrash, toggleStar, toggleArchive } from '../../../../../services/EmailService';

const Inbox = () => {
  // State management
  const [emails, setEmails] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [folderCounts, setFolderCounts] = useState({
    inbox: 0,
    sent: 0,
    starred: 0,
    trash: 0,
    archive: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success'|'error', message: '' }

  // Fetch emails for current folder
  const fetchEmails = useCallback(async (folder = currentFolder) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmails(folder);
      setEmails(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching emails:', error);
      setError('Failed to load emails');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  // Fetch folder counts
  const fetchCounts = useCallback(async () => {
    try {
      const counts = await getFolderCounts();
      setFolderCounts(counts);
    } catch (error) {
      console.error('Error fetching folder counts:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchEmails();
    fetchCounts();
  }, [fetchEmails, fetchCounts]);

  // Auto-hide alerts after 3 seconds
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Handle folder change
  const handleFolderChange = (folder) => {
    setCurrentFolder(folder);
    setSelectedEmails([]);
    setSelectAll(false);
    setAlert(null);
    fetchEmails(folder);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchEmails();
    fetchCounts();
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(emails.map(e => e.id));
    }
    setSelectAll(!selectAll);
  };

  // Handle individual email selection
  const handleEmailSelect = (emailId) => {
    setSelectedEmails(prev => {
      if (prev.includes(emailId)) {
        return prev.filter(id => id !== emailId);
      } else {
        return [...prev, emailId];
      }
    });
  };

  // Handle star toggle
  const handleStarToggle = async (emailId) => {
    try {
      await toggleStar(emailId);
      setAlert({ type: 'success', message: 'Email starred/unstarred successfully!' });
      fetchEmails();
      fetchCounts();
    } catch (error) {
      console.error('Error toggling star:', error);
      setAlert({ type: 'error', message: 'Failed to star/unstar email' });
    }
  };

  // Handle archive
  const handleArchive = async (emailId) => {
    try {
      await toggleArchive(emailId);
      setAlert({ type: 'success', message: 'Email archived/unarchived successfully!' });
      fetchEmails();
      fetchCounts();
    } catch (error) {
      console.error('Error archiving:', error);
      setAlert({ type: 'error', message: 'Failed to archive/unarchive email' });
    }
  };

  // Handle trash
  const handleTrash = async (emailId) => {
    try {
      await moveToTrash(emailId);
      setAlert({ type: 'success', message: currentFolder === 'trash' ? 'Email restored successfully!' : 'Email moved to trash!' });
      fetchEmails();
      fetchCounts();
    } catch (error) {
      console.error('Error moving to trash:', error);
      setAlert({ type: 'error', message: 'Failed to move email to trash' });
    }
  };

  return (
    <div className="container-fluid">
      <PageTitle activeMenu='Inbox' motherMenu='Email' />

      <div className='row'>
        <div className='col-lg-12'>
          <div className='card'>
            <div className='card-body'>
              <div className="row">
                <div className='col-xl-3 col-xxl-4'>
                  <div className='email-left-box'>
                    <div className='p-0'>
                      <Link
                        to='/email-compose'
                        className='btn btn-primary btn-block'
                      >
                        Compose
                      </Link>
                    </div>
                    <div className='mail-list rounded mt-4'>
                      <Link
                        to='#'
                        className={`list-group-item ${currentFolder === 'inbox' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleFolderChange('inbox'); }}
                      >
                        <i className='fa fa-inbox font-18 align-middle me-2'></i>
                        Inbox
                        {folderCounts.inbox > 0 && (
                          <span className='badge badge-primary badge-sm float-end'>
                            {folderCounts.inbox}
                          </span>
                        )}
                      </Link>
                      <Link
                        to='#'
                        className={`list-group-item ${currentFolder === 'sent' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleFolderChange('sent'); }}
                      >
                        <i className='fa fa-paper-plane font-18 align-middle me-2'></i>
                        Sent
                        {folderCounts.sent > 0 && (
                          <span className='badge badge-secondary badge-sm float-end'>
                            {folderCounts.sent}
                          </span>
                        )}
                      </Link>
                      <Link
                        to='#'
                        className={`list-group-item ${currentFolder === 'starred' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleFolderChange('starred'); }}
                      >
                        <i className='fa fa-star font-18 align-middle me-2'></i>
                        Starred
                        {folderCounts.starred > 0 && (
                          <span className='badge badge-warning text-white badge-sm float-end'>
                            {folderCounts.starred}
                          </span>
                        )}
                      </Link>
                      <Link
                        to='#'
                        className={`list-group-item ${currentFolder === 'archive' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleFolderChange('archive'); }}
                      >
                        <i className='mdi mdi-file-document-box font-18 align-middle me-2'></i>
                        Archive
                        {folderCounts.archive > 0 && (
                          <span className='badge badge-info badge-sm float-end'>
                            {folderCounts.archive}
                          </span>
                        )}
                      </Link>
                      <Link
                        to='#'
                        className={`list-group-item ${currentFolder === 'trash' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleFolderChange('trash'); }}
                      >
                        <i className='fa fa-trash font-18 align-middle me-2'></i>
                        Trash
                        {folderCounts.trash > 0 && (
                          <span className='badge badge-danger badge-sm float-end'>
                            {folderCounts.trash}
                          </span>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className='col-xl-9 col-xxl-8'>
                  <div className=''>
                    {/* Alert Notifications */}
                    {alert && (
                      <div className={`alert alert-${alert.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show mb-3`}>
                        {alert.message}
                        <button type="button" className="btn-close" onClick={() => setAlert(null)}></button>
                      </div>
                    )}

                    <div role='toolbar' className='toolbar ms-1 ms-sm-0'>
                      <div className='btn-group mb-1 me-1 ms-1'>
                        <div className='form-check custom-checkbox pl-2'>
                          <input
                            type='checkbox'
                            className='form-check-input'
                            id='checkbox1'
                            checked={selectAll}
                            onChange={handleSelectAll}
                          />
                          <label
                            className='form-check-label'
                            htmlFor='checkbox1'
                          ></label>
                        </div>
                      </div>
                      <div className='btn-group mb-1'>
                        <button
                          className='btn btn-primary light px-3'
                          type='button'
                          onClick={handleRefresh}
                        >
                          <i className='ti-reload'></i>
                        </button>
                      </div>
                      <Dropdown className='btn-group mb-1'>
                        <Dropdown.Toggle
                          aria-expanded='false'
                          data-toggle='dropdown'
                          className='btn btn-primary px-3 light dropdown-toggle ms-1'
                          type='button'
                        >
                          More <span className='caret'></span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu className='dropdown-menu'>
                          {/* Star/Unstar - available in all folders */}
                          {currentFolder !== 'starred' && (
                            <Dropdown.Item
                              onClick={() => selectedEmails.forEach(id => handleStarToggle(id))}
                              className='dropdown-item'
                            >
                              <i className='fa fa-star me-2'></i>
                              Star Selected
                            </Dropdown.Item>
                          )}
                          {currentFolder === 'starred' && (
                            <Dropdown.Item
                              onClick={() => selectedEmails.forEach(id => handleStarToggle(id))}
                              className='dropdown-item'
                            >
                              <i className='fa fa-star-o me-2'></i>
                              Unstar Selected
                            </Dropdown.Item>
                          )}

                          {/* Archive/Unarchive */}
                          {currentFolder !== 'archive' && currentFolder !== 'trash' && (
                            <Dropdown.Item
                              onClick={() => selectedEmails.forEach(id => handleArchive(id))}
                              className='dropdown-item'
                            >
                              <i className='fa fa-archive me-2'></i>
                              Archive Selected
                            </Dropdown.Item>
                          )}
                          {currentFolder === 'archive' && (
                            <Dropdown.Item
                              onClick={() => selectedEmails.forEach(id => handleArchive(id))}
                              className='dropdown-item'
                            >
                              <i className='fa fa-inbox me-2'></i>
                              Unarchive Selected
                            </Dropdown.Item>
                          )}

                          {/* Move to Trash / Restore */}
                          {currentFolder !== 'trash' && (
                            <Dropdown.Item
                              onClick={() => selectedEmails.forEach(id => handleTrash(id))}
                              className='dropdown-item'
                            >
                              <i className='fa fa-trash me-2'></i>
                              Move to Trash
                            </Dropdown.Item>
                          )}
                          {currentFolder === 'trash' && (
                            <Dropdown.Item
                              onClick={() => selectedEmails.forEach(id => handleTrash(id))}
                              className='dropdown-item'
                            >
                              <i className='fa fa-undo me-2'></i>
                              Restore Selected
                            </Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                    <div className='email-list mt-3'>
                      {loading ? (
                        <div className='text-center py-5'>
                          <div className='spinner-border text-primary' role='status'>
                            <span className='visually-hidden'>Loading...</span>
                          </div>
                        </div>
                      ) : error ? (
                        <div className='alert alert-danger'>{error}</div>
                      ) : emails.length === 0 ? (
                        <div className='text-center py-5'>
                          <i className='fa fa-inbox fa-3x text-muted mb-3'></i>
                          <p className='text-muted'>No emails in {currentFolder}</p>
                        </div>
                      ) : (
                        emails.map((email) => (
                          <InboxMessage
                            key={email.id}
                            email={email}
                            isSelected={selectedEmails.includes(email.id)}
                            onSelect={handleEmailSelect}
                            onStarToggle={handleStarToggle}
                            isSent={currentFolder === 'sent'}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Inbox;
