import { NavLink } from 'react-router-dom';

export default function Sidebar({ role = 'Creator' }) {
  const menus = {
    Admin: [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Guidelines', path: '/guidelines' },
      { name: 'User Management', path: '/users' },
      { name: 'All Submissions', path: '/all-submissions' },
      { name: 'AI Findings', path: '/findings' },
      { name: 'Review & Approval', path: '/review' }
    ],

    Manager: [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Guidelines', path: '/guidelines' },
      { name: 'All Submissions', path: '/all-submissions' },
      { name: 'AI Findings', path: '/findings' },
    ],

    Creator: [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Guidelines', path: '/guidelines' },
      { name: 'Submit Content', path: '/submit' },
      { name: 'My Submissions', path: '/submissions' },
      { name: 'AI Findings', path: '/findings' },
    ],
    Reviewer: [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Guidelines', path: '/guidelines' },
      { name: 'All Submissions', path: '/all-submissions' },
      { name: 'AI Findings', path: '/findings' },
      { name: 'Review & Approval', path: '/review' }
    ]
  };

  const currentMenu = menus[role] || menus.Creator;

  return (
    <aside className="sidebar">
      <h3>Workspace</h3>

      <nav className="sidebar-menu">
        {currentMenu.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}