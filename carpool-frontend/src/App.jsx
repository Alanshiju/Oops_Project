import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DriverDashboard from './pages/DriverDashboard';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';

const NavigationBar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Tracks route changes
  const [role, setRole] = useState(null);

  // Re-check authentication on every route change
  useEffect(() => {
    fetch('http://localhost:7070/api/check-auth', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : { isAuthenticated: false }))
      .then(data => {
        if (data && data.isAuthenticated) {
          setRole(data.role);
        } else {
          setRole(null);
        }
      })
      .catch(() => setRole(null));
  }, [location.pathname]);

  const handleLogout = () => {
    fetch('http://localhost:7070/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => {
        setRole(null);
        navigate('/');
      });
  };

  const handleSwitchMode = async (targetMode) => {
    try {
      const res = await fetch('http://localhost:7070/api/user/active-status', { credentials: 'include' });
      const data = await res.json();
      if (data.isDriver && targetMode === '/student') {
        alert("You have an active ride offered! Cancel it first before switching to Student Mode.");
        return;
      }
      if (data.isPassenger && targetMode === '/driver') {
        alert("You have an active booking! Cancel it first before switching to Driver Mode.");
        return;
      }
      navigate(targetMode);
    } catch (e) {
      alert("Error checking status.");
    }
  };

  return (
    <nav className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-extrabold tracking-wider hover:text-blue-200 transition">
          CAMPUS CARPOOL
        </Link>

        <div className="flex items-center gap-6 font-semibold">
          {!role ? (
            <Link to="/login" className="hover:text-blue-300 transition bg-blue-800 px-4 py-2 rounded-lg">
              Sign In
            </Link>
          ) : (
            <>
              {(role === 'USER' || role === 'DRIVER' || role === 'PASSENGER') && (
                <>
                  {location.pathname === '/driver' ? (
                    <button onClick={() => handleSwitchMode('/student')} className="hover:text-blue-300 transition bg-blue-700 px-3 py-1 rounded-lg">
                      Switch to Student Mode
                    </button>
                  ) : (
                    <button onClick={() => handleSwitchMode('/driver')} className="hover:text-blue-300 transition bg-blue-700 px-3 py-1 rounded-lg">
                      Switch to Driver Mode
                    </button>
                  )}
                </>
              )}
              {role === 'ADMIN' && (
                <Link to="/admin" className="hover:text-yellow-300 transition text-yellow-400">
                  Admin Panel
                </Link>
              )}

              <span className="hidden md:inline-block bg-blue-800 text-blue-200 text-xs px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                {role}
              </span>

              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1.5 px-3 rounded-lg transition active:scale-95"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <NavigationBar />

        <div className="flex-grow w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={
                <div className="max-w-6xl mx-auto p-4">
                  <Login />
                </div>
              }
            />

            <Route
              path="/driver"
              element={
                <ProtectedRoute allowedRole="USER">
                  <div className="max-w-6xl mx-auto p-4">
                    <DriverDashboard />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRole="USER">
                  <div className="max-w-6xl mx-auto p-4">
                    <StudentDashboard />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRole="ADMIN">
                  <div className="max-w-6xl mx-auto p-4">
                    <AdminDashboard />
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;