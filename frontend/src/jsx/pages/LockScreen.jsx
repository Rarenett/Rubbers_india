import React from "react";
import { useNavigate } from "react-router-dom";

const LockScreen = ({ history }) => {
   const navigate = useNavigate();
   const submitHandler = (e) => {
      e.preventDefault();
      navigate("/dashboard");
   };
   return (
      <div className="authincation">
         <div className="container">
            <div className="row justify-content-center h-100 align-items-center">
               <div className="col-md-6">
                  <div className="authincation-content">
                     <div className="row no-gutters">
                        <div className="col-xl-12">
                           <div className="auth-form">
                              <h4 className="text-center mb-4">
                                 Account Locked
                              </h4>
                              <form
                                 action=""
                                 onSubmit={(e) => submitHandler(e)}
                              >
                                 <div className="form-group">
                                    <label>
                                       <strong>Password</strong>
                                    </label>
                                    <input
                                       type="password"
                                       className="form-control"
                                       defaultValue="Password"
                                       name="password"
                                    />
                                 </div>
                                 <div className="text-center">
                                    <input
                                       type="submit"
                                       value="Unlock"
                                       className="btn btn-primary btn-block"
                                    />
                                 </div>
                              </form>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default LockScreen;
