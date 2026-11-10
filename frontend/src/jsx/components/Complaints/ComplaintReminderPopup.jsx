import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import ComplaintService from '../../../services/ComplaintService';

const ComplaintReminderPopup = () => {
    const navigate = useNavigate();
    const hasChecked = useRef(false);

    useEffect(() => {
        // Prevent double checking in React strict mode or multiple re-renders
        if (hasChecked.current) return;
        hasChecked.current = true;

        const checkDueReminder = async () => {
            try {
                // If user is logged in, there should be user details in local storage
                const userDetailsStr = localStorage.getItem('userDetails');
                if (!userDetailsStr) return;

                const res = await ComplaintService.getDueReminder();
                const complaint = res.data;

                if (complaint && complaint.id) {
                    const formattedDate = complaint.cutoff_date ? complaint.cutoff_date.split('-').reverse().join('-') : '';
                    
                    const showComplaintAlert = () => {
                        // If another SweetAlert is already open, wait 500ms and try again
                        if (Swal.isVisible()) {
                            setTimeout(showComplaintAlert, 500);
                            return;
                        }

                        Swal.fire({
                            title: 'Upcoming Complaint Due!',
                            html: `
                                <div style="text-align: left;">
                                    <p><strong>Title:</strong> ${complaint.title}</p>
                                    <p><strong>Category:</strong> ${complaint.category_name}</p>
                                    <p><strong>Cutoff Date:</strong> <span style="color: #ef4444; font-weight: bold;">${formattedDate}</span></p>
                                </div>
                            `,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'View Complaint',
                            cancelButtonText: 'Dismiss',
                            confirmButtonColor: '#0a500f',
                            cancelButtonColor: '#dc3545'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                navigate(`/complaints/detail/${complaint.id}`);
                            }
                        });
                    };

                    // Start the alert sequence
                    showComplaintAlert();
                }
            } catch (error) {
                console.error("Error checking due reminders:", error);
            }
        };

        checkDueReminder();
    }, [navigate]);

    return null; // This component doesn't render any visible DOM elements
};

export default ComplaintReminderPopup;
