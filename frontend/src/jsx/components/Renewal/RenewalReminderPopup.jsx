import React, { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { getMyDueRenewalReminders } from '../../../services/RenewalService';
import { formatDate } from '../../../utils/dateUtils';

const RenewalReminderPopup = () => {
    const shownRef = useRef(false);

    useEffect(() => {
        if (shownRef.current) return;
        shownRef.current = true;

        const checkAndShowReminders = async () => {
            try {
                const data = await getMyDueRenewalReminders();
                const list = Array.isArray(data) ? data : (data?.results || []);
                if (list.length === 0) return;

                window.reminderPopupQueue = window.reminderPopupQueue || Promise.resolve();

                window.reminderPopupQueue = window.reminderPopupQueue.then(async () => {
                    for (let i = 0; i < list.length; i++) {
                        const item = list[i];
                        const htmlContent = `
                            <div style="text-align: left; background: #f8fafc; padding: 18px 20px; border-radius: 10px; margin-top: 15px; border: 1px solid #e2e8f0; font-size: 14px; color: #334155;">
                                <div style="margin-bottom: 10px;">
                                    <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Renewal Name</span>
                                    <div style="font-weight: 700; font-size: 16px; color: #1e293b; margin-top: 2px;">
                                        ${item.name || '-'}
                                    </div>
                                </div>
                                ${item.renewal_subject_name ? `
                                <div style="margin-bottom: 10px;">
                                    <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Subject</span>
                                    <div style="font-weight: 600; color: #334155; margin-top: 2px;">
                                        ${item.renewal_subject_name}
                                    </div>
                                </div>` : ''}
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; flex-wrap: wrap; gap: 10px;">
                                    <div>
                                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Renewal Date</span>
                                        <div style="font-weight: 700; color: #1e293b; margin-top: 2px;">
                                            ${item.renewal_date ? formatDate(item.renewal_date) : '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Schedule</span>
                                        <div style="font-weight: 600; color: #334155; margin-top: 2px;">
                                            ${item.reminder_days || 30} days before
                                        </div>
                                    </div>
                                    <div>
                                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Department</span>
                                        <div style="font-weight: 600; color: #334155; margin-top: 2px;">
                                            ${item.department_name || 'General'}
                                        </div>
                                    </div>
                                </div>
                                ${item.remarks ? `
                                <div style="border-top: 1px solid #e2e8f0; padding-top: 10px;">
                                    <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Remarks / Instructions</span>
                                    <div style="font-weight: 500; color: #475569; margin-top: 2px; white-space: pre-wrap;">
                                        ${item.remarks}
                                    </div>
                                </div>` : ''}
                            </div>
                            ${list.length > 1 ? `<div style="margin-top: 14px; font-size: 12px; color: #64748b; font-weight: 600;">Reminder ${i + 1} of ${list.length}</div>` : ''}
                        `;

                        await Swal.fire({
                            icon: 'warning',
                            title: 'Renewal Reminder Alert',
                            html: htmlContent,
                            confirmButtonText: i < list.length - 1 ? 'Okay (Next)' : 'Okay',
                            confirmButtonColor: '#6259ca',
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            focusConfirm: true
                        });
                    }
                });
            } catch (error) {
                console.error("Error checking due renewal reminders:", error);
            }
        };

        checkAndShowReminders();
    }, []);

    return null;
};

export default RenewalReminderPopup;
