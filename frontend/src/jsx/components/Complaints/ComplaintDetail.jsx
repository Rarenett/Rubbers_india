import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ComplaintService from '../../../services/ComplaintService';
import ComplaintResponderView from './ComplaintResponderView';
import ComplaintFinalDecisionView from './ComplaintFinalDecisionView';

const ComplaintDetail = () => {
    const { id } = useParams();
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        ComplaintService.getComplaint(id).then(res => {
            setComplaint(res.data);
            setLoading(false);
        }).catch(err => {
            console.error("Error fetching complaint", err);
            setLoading(false);
        });
    }, [id]);

    if (loading) return <div className="p-5 text-center">Loading...</div>;
    if (!complaint) return <div className="p-5 text-center text-danger">Complaint not found</div>;

    // Route to Responder View if they have the right to respond (employee flow)
    // Otherwise route to the Final Decision View (which also acts as a read-only view for creators)
    if (complaint.can_respond) {
        return <ComplaintResponderView id={id} initialComplaint={complaint} />;
    } else {
        return <ComplaintFinalDecisionView id={id} initialComplaint={complaint} />;
    }
};

export default ComplaintDetail;
