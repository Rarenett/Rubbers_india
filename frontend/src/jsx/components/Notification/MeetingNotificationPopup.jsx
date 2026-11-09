import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { getNotifications, markNotificationAsRead } from '../../../services/NotificationService.js';

const MeetingNotificationPopup = () => {
 const processedIds = useRef(new Set());

 useEffect(() => {
 const checkNotifications = async () => {
 try {
 const notifications = await getNotifications();

 // Filter for unread, meeting alerts, and unprocessed IDs
 const newMeetings = notifications.filter(n =>
 !n.is_read &&
 (n.notification_type === 'meeting_approved' || n.notification_type === 'meeting_reminder') &&
 !processedIds.current.has(n.id)
 );

 if (newMeetings.length > 0) {
 newMeetings.forEach(notif => {
 processedIds.current.add(notif.id);

 const isReminder = notif.notification_type === 'meeting_reminder';

 // Show SweetAlert2 Toast
 const Toast = Swal.mixin({
 toast: true,
 position: 'top-end',
 showConfirmButton: false,
 timer: 6000,
 timerProgressBar: true,
 didOpen: (toast) => {
 toast.addEventListener('mouseenter', Swal.stopTimer)
 toast.addEventListener('mouseleave', Swal.resumeTimer)
 }
 });

 Toast.fire({
 icon: isReminder ? 'warning' : 'success',
 title: isReminder ? 'Meeting Reminder!' : 'Meeting Approved!',
 text: notif.message,
 background: '#fff',
 color: '#333',
 iconColor: isReminder ? '#f39c12' : '#27ae60',
 });

 // Mark as read so it doesn't show up again on refresh
 markNotificationAsRead(notif.id).catch(err =>
 console.error(`Error marking notification ${notif.id} as read:`, err)
 );
 });
 }
 } catch (error) {
 console.error('Error in meeting notification popup:', error);
 }
 };

 // Poll every 30 seconds (half of the minute requested to be responsive)
 const interval = setInterval(checkNotifications, 30000);

 // Initial check
 checkNotifications();

 return () => clearInterval(interval);
 }, []);

 return null; // This component doesn't render anything itself
};

export default MeetingNotificationPopup;
