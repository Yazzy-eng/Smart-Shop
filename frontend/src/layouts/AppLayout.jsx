import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', roles: ['admin', 'manager', 'cashier'] },
  { to: '/pos', label: 'Sales / POS', roles: ['admin', 'manager', 'cashier'] },
  { to: '/customers', label: 'Customers', roles: ['admin', 'manager'] },
  { to: '/inventory', label: 'Inventory', roles: ['admin', 'manager'] },
  { to: '/reports', label: 'Reports', roles: ['admin', 'manager'] },
  { to: '/admin/users', label: 'User Management', roles: ['admin'] },
  { to: '/admin/settings', label: 'Settings', roles: ['admin'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-800">
          <h1 className="font-bold text-lg">Deeqsan Store</h1>
          <p className="text-xs text-slate-400">Point of Sale</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800">
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="text-xs text-slate-400 capitalize mb-3">{user.role}</p>
          <button
            onClick={logout}
            className="w-full text-sm bg-slate-800 hover:bg-slate-700 rounded-lg py-2 transition"
          >
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
