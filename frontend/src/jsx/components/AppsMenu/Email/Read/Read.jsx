import React, { Fragment, useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Dropdown } from 'react-bootstrap'
import PageTitle from '../../../../layouts/PageTitle'
import EmailService from '../../../../../services/EmailService'

const Read = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchEmail = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) {
           if (mounted) setError('No email ID provided');
           return;
        }
        const data = await EmailService.getEmailById(id);
        if (mounted) {
           setEmail(data);
           // Mark as read if not already read
           if (!data.is_read && data.label !== 'sent') {
             try {
                await EmailService.markAsRead(id);
             } catch (e) {
                console.error("Failed to mark as read", e);
             }
           }
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
           setError(err?.response?.status === 404 ? 'Email not found.' : 'Failed to load email.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEmail();
    return () => { mounted = false; };
  }, [id]);

  // Sidebar component to reuse
  const Sidebar = () => (
    <div className='col-xl-3 col-xxl-4'>
        <div className='email-left-box'>
          <div className='p-0'>
            <Link to='/email-compose' className='btn btn-primary btn-block'>
              Compose
            </Link>
          </div>
          <div className='mail-list rounded mt-4'>
            <Link to='/email-inbox' className='list-group-item'>
              <i className='fa fa-inbox font-18 align-middle me-2'></i> Inbox
            </Link>
            <Link to='/email-inbox' className='list-group-item'>
              <i className='fa fa-paper-plane font-18 align-middle me-2'></i> Sent
            </Link>
            <Link to='/email-inbox' className='list-group-item'>
              <i className='fa fa-star font-18 align-middle me-2'></i> Starred
            </Link>
            <Link to='/email-inbox' className='list-group-item'>
              <i className='fa fa-trash font-18 align-middle me-2'></i> Trash
            </Link>
          </div>
        </div>
    </div>
  );

  return (
    <Fragment>
      <PageTitle activeMenu='Read' motherMenu='Email' />

      <div className='row'>
        <div className='col-lg-12'>
          <div className='card'>
            <div className='card-body'>
              <div className='row'>
                <Sidebar />
                <div className='col-xl-9 col-xxl-8'>
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="sr-only">Loading email...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-5">
                            <h4 className="text-danger">{error}</h4>
                            <button className="btn btn-primary mt-3" onClick={() => navigate('/email-inbox')}>
                                Return to Inbox
                            </button>
                        </div>
                    ) : !email ? (
                        <div className="text-center py-5">
                            <h4 className="text-danger">Email not found</h4>
                            <button className="btn btn-primary mt-3" onClick={() => navigate('/email-inbox')}>
                                Return to Inbox
                            </button>
                        </div>
                    ) : (
                        <div>
                          <div className='row'>
                            <div className='col-12'>
                              <div className='right-box-padding'>
                                <div className='toolbar mb-4 d-flex justify-content-between align-items-center' role='toolbar'>
                                  <div className='btn-group mb-1'>
                                    <button type='button' className='btn btn-primary light px-3 me-1' onClick={() => navigate(-1)} title="Back">
                                      <i className='fa fa-arrow-left'></i>
                                    </button>
                                    <button type='button' className='btn btn-primary light px-3 me-1' onClick={() => {
                                        EmailService.moveToTrash(id).then(() => navigate('/email-inbox'));
                                    }} title="Move to Trash">
                                      <i className='fa fa-trash'></i>
                                    </button>
                                  </div>
                                </div>
                                <div className='read-content'>
                                  <div className='media pt-3 d-sm-flex d-block justify-content-between'>
                                    <div className='clearfix mb-3 d-flex'>
                                      <div
                                        className="d-flex align-items-center justify-content-center fw-bold text-white shadow-sm me-3 rounded"
                                        style={{
                                          width: '50px', height: '50px',
                                          background: 'linear-gradient(135deg, #0a500f 0%, #2bb673 100%)',
                                          fontSize: '18px'
                                        }}
                                      >
                                        {(email.sender?.first_name?.[0] || email.sender?.email?.[0] || 'U').toUpperCase()}
                                      </div>
                                      <div className='media-body me-2'>
                                        <h5 className='text-primary mb-0 mt-1'>
                                          {email.sender?.first_name} {email.sender?.last_name}
                                        </h5>
                                        <p className='mb-0 text-muted'>
                                            {email.sender?.email}
                                        </p>
                                      </div>
                                    </div>
                                    <div className='clearfix mb-3'>
                                        <span className="text-muted">{new Date(email.created_at).toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <hr />
                                  <div className='media mb-2 mt-3'>
                                    <div className='media-body'>
                                      <h5 className='my-1 text-primary'>
                                        {email.subject || '(No Subject)'}
                                      </h5>
                                      <p className='read-content-email'>
                                        To: {email.recipients_details?.map(r => r.user.email).join(', ') || 'Unknown'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className='read-content-body'>
                                    <div className="mt-4 text-dark" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                        {email.body}
                                    </div>
                                    <hr />
                                  </div>
                                  {email.attachments && email.attachments.length > 0 && (
                                      <div className='read-content-attachment'>
                                        <h6>
                                          <i className='fa fa-download mb-2'></i>
                                          Attachments
                                          <span> ({email.attachments.length})</span>
                                        </h6>
                                        <div className='row attachment mt-3'>
                                          {email.attachments.map((att, idx) => {
                                              const fileName = att.file.split('/').pop();
                                              return (
                                                  <div className='col-auto mb-2' key={idx}>
                                                    <a href={att.file} target="_blank" rel="noopener noreferrer" className='btn btn-outline-primary btn-sm'>
                                                      <i className="fa fa-file me-2"></i>
                                                      {fileName}
                                                    </a>
                                                  </div>
                                              )
                                          })}
                                        </div>
                                      </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  )
}

export default Read
