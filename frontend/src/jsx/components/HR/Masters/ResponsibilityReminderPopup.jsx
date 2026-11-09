import React, { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { getPendingResponsibilityReminders } from '../../../../services/HRManagementService';

const ResponsibilityReminderPopup = () => {
    const shownRef = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (shownRef.current) return;
        shownRef.current = true;

        const fetchPendingReminders = async () => {
            try {
                const data = await getPendingResponsibilityReminders();
                if (data && data.length > 0) {
                    window.reminderPopupQueue = window.reminderPopupQueue || Promise.resolve();

                    window.reminderPopupQueue = window.reminderPopupQueue.then(async () => {
                        for (let i = 0; i < data.length; i++) {
                            const reminder = data[i];
                            const htmlContent = `
                                <div style="text-align: left; background: #f8fafc; padding: 18px 20px; border-radius: 10px; margin-top: 15px; border: 1px solid #e2e8f0; font-size: 14px; color: #334155;">
                                    <div style="margin-bottom: 10px;">
                                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Responsibility</span>
                                        <div style="font-weight: 700; font-size: 16px; color: #1e293b; margin-top: 2px;">
                                            ${reminder.responsibility_name || '-'}
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; flex-wrap: wrap; gap: 10px;">
                                        <div>
                                            <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Date</span>
                                            <div style="font-weight: 700; color: #1e293b; margin-top: 2px;">
                                                ${reminder.start_date || reminder.reminder_date || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Department</span>
                                            <div style="font-weight: 600; color: #334155; margin-top: 2px;">
                                                ${reminder.department_name || 'General'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ${data.length > 1 ? `<div style="margin-top: 14px; font-size: 12px; color: #64748b; font-weight: 600;">Reminder ${i + 1} of ${data.length}</div>` : ''}
                            `;

                            const result = await Swal.fire({
                                icon: 'warning',
                                title: 'Responsibility Reminder Alert',
                                html: htmlContent,
                                showCancelButton: true,
                                confirmButtonText: 'Go to Tasks',
                                cancelButtonText: 'Close for now',
                                confirmButtonColor: '#6259ca',
                                allowOutsideClick: false,
                                allowEscapeKey: false,
                                focusConfirm: true
                            });

                            if (result.isConfirmed) {
                                navigate('/hr/my-responsibilities');
                                break;
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to fetch pending reminders', error);
            }
        };

        fetchPendingReminders();
    }, [navigate]);

    return null;
};

export default ResponsibilityReminderPopup;
