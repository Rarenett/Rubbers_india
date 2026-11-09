import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PageTitle from '../../../layouts/PageTitle';

const StockReportsManagement = () => {
    const { type } = useParams();

    return (
        <>
            <PageTitle activeMenu={type ? `Stock Report: ${type}` : "Stock Reports"} motherMenu="Inventory" />
            <div className="row">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h4 className="card-title">Stock Reports</h4>
                        </div>
                        <div className="card-body">
                            <p>Stock reports will be rendered here. (Currently building {type || 'default'})</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StockReportsManagement;
