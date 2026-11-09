import React, { createContext, useContext, useEffect, useRef } from 'react';
import axiosInstance from '../services/AxiosInstance';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';
import { useLocation } from 'react-router-dom';

const TaskReminderContext = createContext();

export const useTaskReminder = () => useContext(TaskReminderContext);

export const TaskReminderProvider = ({ children }) => {
    const { auth } = useSelector(state => state.auth || {});
    const location = useLocation();
    
    const storedUser = (() => {
        try {
            const details = localStorage.getItem('userDetails');
            return details ? JSON.parse(details)?.user || JSON.parse(details) : null;
        } catch {
            return null;
        }
    })();
    const isAuthenticated = auth?.access || auth?.user || storedUser ? true : false;
    
    const [notificationPermission, setNotificationPermission] = React.useState(
        'Notification' in window ? Notification.permission : 'default'
    );

    const getTriggeredAlerts = () => {
        try {
            return new Set(JSON.parse(localStorage.getItem('triggeredTaskAlerts') || '[]'));
        } catch {
            return new Set();
        }
    };
    
    // Store tasks in a ref so the interval always accesses the latest data without resetting
    const tasksRef = useRef([]);
    const triggeredAlerts = useRef(getTriggeredAlerts());

    // Helper to convert VAPID key
    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const PUBLIC_VAPID_KEY = "BEMUrvEZaDjjKkzGMAquauLydHsajvWrUyJT8NosO_xHMeNPKY2aG6rNwj80AazqZLUxx3EofwrimLfQqwTcRmc";

    const enablePushNotifications = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Register Service Worker for robust background notifications
                const registration = await navigator.serviceWorker.register('/sw.js');
                
                // Request Notification permission
                let permission = Notification.permission;
                if (permission !== 'granted') {
                    permission = await Notification.requestPermission();
                    setNotificationPermission(permission);
                }

                if (permission === 'granted') {
                    // Subscribe to Push
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
                    });

                    // Send subscription to backend
                    if (isAuthenticated) {
                        await axiosInstance.post('/api/task-management/tasks/subscribe_push/', subscription.toJSON());
                        Swal.fire("Success", "Push Notifications Enabled!", "success");
                    }
                } else {
                    Swal.fire("Blocked", "You have blocked notifications in your browser settings. Please click the icon in your address bar to allow them.", "error");
                }
            } catch (err) {
                console.warn('Service worker push setup failed:', err);
                Swal.fire("Error", "Failed to setup push notifications.", "error");
            }
        } else {
            Swal.fire("Not Supported", "Your browser does not support Web Push Notifications.", "error");
        }
    };

    useEffect(() => {
        // Attempt silently on mount if already granted and on task management page
        const isTaskPage = location.pathname.includes('task-management') || location.pathname.includes('/task');
        if (Notification.permission === 'granted' && isTaskPage) {
            enablePushNotifications();
        }
    }, [isAuthenticated, location.pathname]);

    useEffect(() => {
        if (!isAuthenticated) return;

        // Fetch active tasks periodically
        const fetchTasks = async () => {
            try {
                const res = await axiosInstance.get('/api/task-management/tasks/');
                let adminRes = { data: [] };
                try {
                    adminRes = await axiosInstance.get('/api/task-management/admin-tasks/');
                } catch (err) {
                    console.warn("Could not fetch admin tasks", err);
                }

                const activeTasks = Array.isArray(res.data) ? res.data : res.data.results || [];
                const adminTasks = Array.isArray(adminRes.data) ? adminRes.data : adminRes.data.results || [];
                
                const allTasksMap = new Map();
                [...activeTasks, ...adminTasks].forEach(t => {
                    if (t.status !== 'Completed' && t.status !== 'Cancelled' && t.status !== 'Deleted') {
                        allTasksMap.set(t.id, t);
                    }
                });
                tasksRef.current = Array.from(allTasksMap.values());
            } catch (err) {
                console.error("Error fetching tasks for reminders", err);
            }
        };

        fetchTasks();
        const fetchInterval = setInterval(fetchTasks, 30000); // refresh task list every 30s

        // Instantly resync on any global task mutations
        const handleMutation = () => fetchTasks();
        window.addEventListener('taskMutated', handleMutation);

        // Function that performs the actual time check
        const performTimeCheck = () => {
            const now = new Date();
            const nowTime = now.getTime();

            tasksRef.current.forEach(task => {
                if (!task.deadline) return;

                const deadlineDate = new Date(task.deadline);
                const deadlineTime = deadlineDate.getTime();
                
                // Helper to fire alert using a queue so Swal doesn't overwrite itself
                const fireAlert = (alertId, title, text, icon) => {
                    // Strong cross-tab mutex using localStorage
                    const existingStr = localStorage.getItem('triggeredTaskAlerts') || '[]';
                    let existing;
                    try { existing = new Set(JSON.parse(existingStr)); } catch { existing = new Set(); }
                    
                    if (existing.has(alertId) || triggeredAlerts.current.has(alertId)) {
                        triggeredAlerts.current.add(alertId); // sync local ref
                        return;
                    }
                    
                    // Mark as triggered immediately to lock out other tabs
                    existing.add(alertId);
                    triggeredAlerts.current.add(alertId);
                    localStorage.setItem('triggeredTaskAlerts', JSON.stringify([...existing]));
                    
                    window.swalQueue = window.swalQueue || [];
                    window.isSwalProcessing = window.isSwalProcessing || false;

                    window.swalQueue.push({
                        title: title,
                        text: text,
                        icon: icon,
                        confirmButtonText: "Acknowledge",
                    });

                    const processSwalQueue = async () => {
                        if (window.isSwalProcessing || window.swalQueue.length === 0) return;
                        window.isSwalProcessing = true;
                        const alertOptions = window.swalQueue.shift();
                        await Swal.fire(alertOptions);
                        window.isSwalProcessing = false;
                        processSwalQueue(); // process next in queue
                    };
                    
                    // Call the processor to trigger the SweetAlert popup!
                    processSwalQueue();

                    // Browser Notification
                    if ('Notification' in window) {
                        if (Notification.permission === 'granted') {
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistration().then(registration => {
                                    if (registration) {
                                        registration.showNotification(title, { 
                                            body: text, 
                                            requireInteraction: true,
                                            icon: '/small-logo.png',
                                            tag: alertId
                                        });
                                    } else {
                                        new Notification(title, { body: text, requireInteraction: true, icon: '/small-logo.png', tag: alertId });
                                    }
                                });
                            } else {
                                new Notification(title, { body: text, requireInteraction: true, icon: '/small-logo.png', tag: alertId });
                            }
                        } else if (Notification.permission !== 'denied') {
                            Notification.requestPermission();
                        }
                    }

                    // FLASH THE BROWSER TAB TITLE (Highly visible when minimized or in another tab)
                    if (document.hidden) {
                        const originalTitle = document.title;
                        let isFlashed = false;
                        const flashInterval = setInterval(() => {
                            document.title = isFlashed ? originalTitle : `🔔 ${title}!`;
                            isFlashed = !isFlashed;
                        }, 1000);

                        // Stop flashing when they open/focus the tab
                        const stopFlashing = () => {
                            clearInterval(flashInterval);
                            document.title = originalTitle;
                            window.removeEventListener('focus', stopFlashing);
                        };
                        window.addEventListener('focus', stopFlashing);
                    }

                    // Play an audible beep just in case the visual notification is blocked by the OS
                    try {
                        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 800; // Frequency in Hz
                        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Volume
                        oscillator.start();
                        setTimeout(() => oscillator.stop(), 500); // Beep for 500ms
                    } catch (e) {
                        console.error("Audio beep failed:", e);
                    }
                };

                const getStartTime = () => {
                    if (task.plannedDate && task.plannedStartTime) {
                        return new Date(`${task.plannedDate}T${task.plannedStartTime}`).getTime();
                    }
                    // Fallback if planned Date/Time are missing for some reason
                    return deadlineTime - ( ((task.expectedHours || 0) * 60 + (task.expectedMinutes || 0)) * 60000 );
                };

                const startTimeMs = getStartTime();

                // Auto-start task if it is Pending and planned start time has arrived
                if (task.status === 'Pending' && nowTime >= startTimeMs) {
                    task.status = 'In Progress'; // Optimistic update to prevent multiple triggers
                    axiosInstance.post(`/api/task-management/tasks/${task.id}/start_task/`)
                        .then(() => {
                            window.dispatchEvent(new Event('taskMutated'));
                        })
                        .catch(err => {
                            console.error("Error auto-starting task:", err);
                            task.status = 'Pending'; // Revert on failure
                        });
                }

                // Check Reminders
                const checkReminder = (mins, typeNum, isTriggered) => {
                    if (isTriggered) return; // Backend already knows it triggered
                    
                    if (mins !== null && mins !== undefined && mins !== '') {
                        let remTime;
                        if (task.reminderSystem === 'End Time Based') {
                            remTime = deadlineTime - (parseInt(mins) * 60000);
                        } else {
                            // Default to Duration Based (count forward from start time)
                            remTime = getStartTime() + (parseInt(mins) * 60000);
                        }
                        // Trigger anytime after the reminder time is reached
                        // LocalStorage prevents it from firing multiple times
                        if (nowTime >= remTime) {
                            const isTaskPage = window.location.pathname.includes('task-management') || window.location.pathname.includes('/task');
                            if (!isTaskPage) return; // Do not trigger, do not notify backend, until they visit the page.
                            
                            // Quick sanity check: If it's more than 24 hours overdue, just suppress it
                            if (nowTime - remTime > 24 * 60 * 60 * 1000) return;
                            
                            const totalMins = (task.expectedHours || 0) * 60 + (task.expectedMinutes || 0);
                            const remainingMins = task.reminderSystem === 'End Time Based' ? mins : (totalMins - mins);
                            
                            let text = `${remainingMins} minutes remaining!`;
                            fireAlert(`${task.id}-rem-${typeNum}`, "Task Reminder", `Task: ${task.taskName}\n${text}`, "info");
                            
                            // Tell backend it was triggered!
                            axiosInstance.post(`/api/task-management/tasks/${task.id}/mark_reminder_triggered/`, { reminderType: typeNum })
                                .catch(err => {
                                    axiosInstance.post(`/api/task-management/admin-tasks/${task.id}/mark_reminder_triggered/`, { reminderType: typeNum })
                                        .catch(e => console.warn(e));
                                });
                        }
                    }
                };

                checkReminder(task.firstReminderMinutes, 1, task.firstReminderTriggered);
                checkReminder(task.secondReminderMinutes, 2, task.secondReminderTriggered);
                checkReminder(task.thirdReminderMinutes, 3, task.thirdReminderTriggered);
                checkReminder(task.fourthReminderMinutes, 4, task.fourthReminderTriggered);
                checkReminder(task.fifthReminderMinutes, 5, task.fifthReminderTriggered);
                // Check Deadline Reached
                if (nowTime >= deadlineTime && task.status !== 'Incomplete' && task.status !== 'Completed') {
                    task.status = 'Incomplete'; // Optimistic update
                    
                    // Fire backend update to ensure it's permanently saved
                    axiosInstance.post(`/api/task-management/tasks/${task.id}/update_status/`, { status: 'Incomplete' })
                        .then(() => {
                            window.dispatchEvent(new Event('taskMutated'));
                        })
                        .catch(err => {
                            // If 404, it might be an admin task, so try the admin endpoint
                            axiosInstance.post(`/api/task-management/admin-tasks/${task.id}/update_status/`, { status: 'Incomplete' })
                                .then(() => {
                                    window.dispatchEvent(new Event('taskMutated'));
                                })
                                .catch(e => console.error("Error auto-updating admin task to incomplete:", e));
                        });
                }

                // The extra overdue reminders (every 5 mins) have been removed per user request.
            });
        };

        // Standard timer (will throttle to ~1 min when tab is minimized)
        const ticker = setInterval(performTimeCheck, 1000);

        // Force an immediate check whenever the tab becomes visible again
        const handleVisibilityChange = () => {
            if (!document.hidden) performTimeCheck();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(fetchInterval);
            clearInterval(ticker);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('taskMutated', handleMutation);
        };
    }, [isAuthenticated]);

    return (
        <TaskReminderContext.Provider value={{
            enablePushNotifications,
            notificationPermission
        }}>
            {children}
        </TaskReminderContext.Provider>
    );
};
