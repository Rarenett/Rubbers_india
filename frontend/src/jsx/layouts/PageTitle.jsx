import React from "react";
import { Link } from "react-router-dom";

const PageTitle = ({ motherMenu, activeMenu, pageContent }) => {
  let path = window.location.pathname.split("/");

  return (
    <div className="row page-titles mx-0">
      <div className="col-sm-6 p-md-0">
        <div className="welcome-text">
          {pageContent && (
            <p className="mb-0">
              {pageContent}
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

export default PageTitle;
