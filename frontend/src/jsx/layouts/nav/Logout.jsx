import React  from 'react';
import {connect, useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import Swal from 'sweetalert2';
import { Logout } from '../../../store/actions/AuthActions';
import { isAuthenticated } from '../../../store/selectors/AuthSelectors';

function withRouter(Component) {
  function ComponentWithRouterProp(props) {
    let location = useLocation();
    let navigate = useNavigate();
    let params = useParams();
    return (
      <Component
        {...props}
        router={{ location, navigate, params }}
      />
    );
  }

  return ComponentWithRouterProp;
}


function LogoutPage(props){
    
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = props;

    function onLogout() {
        let isMarketing = false;
        if (user) {
            if (user.email === 'aleena@gmail.com') {
                isMarketing = true;
            } else if (user.department) {
                const deptName = typeof user.department === 'object' ? user.department.name : user.department;
                if (deptName && String(deptName).toLowerCase().includes('marketing')) {
                    isMarketing = true;
                }
            }
        }

        if (isMarketing) {
            Swal.fire({
                title: 'End of Day Travel Check',
                text: "Have you entered your End KM and uploaded the odometer photo?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, Logout',
                cancelButtonText: 'No, Go to Transport'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem('redirect_after_login');
                    localStorage.removeItem('redirect_user_email');
                    dispatch(Logout(navigate));        
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    navigate('/market_connect_master/transport');
                }
            });
        } else {
            localStorage.removeItem('redirect_after_login');
            localStorage.removeItem('redirect_user_email');
            dispatch(Logout(navigate)); 
        }
    }
    return(
        <>
            <button className="dropdown-item ai-icon" onClick={onLogout}>
                <svg
                  id="icon-logout" xmlns="http://www.w3.org/2000/svg"
                  style={{ color: '#dc3545' }} width={18} height={18} viewBox="0 0 24 24" 
                  fill="none" stroke="#dc3545" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1={21} y1={12} x2={9} y2={12} />
                </svg>
                <span className="ms-2" >Logout </span>
            </button>
        </>
    )
} 
const mapStateToProps = (state) => {
    return {
        isAuthenticated: isAuthenticated(state),
        user: state.auth.auth.user,
    };
};

export default withRouter(connect(mapStateToProps)(LogoutPage));