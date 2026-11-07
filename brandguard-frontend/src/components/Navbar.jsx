
import { useNavigate } from 'react-router-dom';
import { getSavedUser, logoutUser } from '../services/api';

export default function Navbar({ userName, role }) {
  const navigate = useNavigate();

  const user = getSavedUser();

  const displayName = userName || user?.name || 'User';
  const displayRole = role || user?.role || 'Creator';

  function handleLogout() {
    logoutUser();
    navigate('/', { replace: true });
  }

  return (
    <nav className="navbar">
      <h2>BrandGuard AI</h2>

      <div className="navbar-right">
        <div className="user-info">
          <span className="user-name">{displayName}</span>
          <span className="user-role">{displayRole}</span>
        </div>

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
