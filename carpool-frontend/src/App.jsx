import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import DriverDashboard from "./pages/DriverDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile";
import { Toaster } from "react-hot-toast";

import Layout from "./components/Layout";
import About from "./pages/About";
import Contact from "./pages/Contact";
import HowItWorks from "./pages/HowItWorks";
import Forums from "./pages/Forums";
import GlobalChatWidget from "./components/GlobalChatWidget";
import { API_BASE_URL } from "./config/api";
import ScrollToTop from "./components/ScrollToTop";

function AppContent() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-auth`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.isAuthenticated) {
          setIsAuthenticated(true);
          setIsVerified(Boolean(data.isVerified));
          setProfileName(data.name || "User");
        } else {
          setIsAuthenticated(false);
          setIsVerified(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsVerified(false);
      });
  }, [location.pathname]);

  const hideGlobalWidget = ["/driver", "/student", "/forums"].includes(
    location.pathname,
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden">
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* All other routes wrapped in Layout */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/forums" element={<Forums />} />

                <Route
                  path="/driver"
                  element={
                    <ProtectedRoute allowedRole="USER">
                      <div className="max-w-6xl mx-auto p-4 w-full">
                        <DriverDashboard />
                      </div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRole="USER">
                      <div className="max-w-6xl mx-auto p-4 w-full">
                        <StudentDashboard />
                      </div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRole="ADMIN">
                      <div className="max-w-6xl mx-auto p-4 w-full">
                        <AdminDashboard />
                      </div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute allowedRole="USER">
                      <div className="max-w-6xl mx-auto p-4 w-full">
                        <Profile />
                      </div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Layout>
          }
        />
      </Routes>
      {!hideGlobalWidget && isAuthenticated && isVerified && (
        <GlobalChatWidget profileName={profileName} />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster position="top-center" reverseOrder={false} />
      <AppContent />
    </Router>
  );
}

export default App;
