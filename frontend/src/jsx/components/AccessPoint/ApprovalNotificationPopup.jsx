import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../services/AxiosInstance';

const ApprovalNotificationPopup = () => {
    // Screen-blocking popup disabled per project workflow requirement.
    // Host employees manage their approvals on the "My Approvals" page.
    return null;
};

export default ApprovalNotificationPopup;
