import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../config/api";

const Navbar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check auth state on mount and route changes
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-auth`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.isAuthenticated) {
          setIsAuthenticated(true);
          setRole(data.role);
        } else {
          setIsAuthenticated(false);
          setRole(null);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setRole(null);
      });
  }, [location.pathname]);

  // Synchronize dark mode class and storage with state
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const handleThemeToggle = () => setIsDarkMode((prev) => !prev);

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error(err);
    }
    document.cookie = "jwt=; Max-Age=0; path=/";
    setIsAuthenticated(false);
    setRole(null);
    navigate("/login");
  };

  const handleModeSwitch = async (e, targetMode) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/active-status`, {
        headers: {
          Authorization: `Bearer ${
            document.cookie
              .split("; ")
              .find((row) => row.startsWith("jwt="))
              ?.split("=")[1]
          }`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.hasActiveRide || data.currentRideId !== null) {
          toast.error(
            "Please complete or cancel your active ride before switching modes.",
          );
          if (isMobileMenuOpen) toggleMenu();
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }

    if (isMobileMenuOpen) toggleMenu();
    navigate(targetMode);
  };

  const isDriver = location.pathname.includes("/driver");
  const isStudent = location.pathname.includes("/student");

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 backdrop-blur-xl transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <span className="font-extrabold text-2xl tracking-tight text-indigo-950 dark:text-white hover:text-indigo-700 dark:hover:text-emerald-400 transition-colors">
              CAMPUS<span className="text-emerald-500">POOL</span>
            </span>
          </Link>

          {/* Desktop Center Menu - Pill Container */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/60 rounded-full p-1.5 border border-slate-200/50 dark:border-slate-700/50">
            <Link
              to="/"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                location.pathname === "/"
                  ? "bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
              }`}
            >
              Home
            </Link>
            <Link
              to="/forums"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                location.pathname === "/forums"
                  ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-sm"
                  : "text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
              }`}
            >
              Forums
            </Link>
            <Link
              to="/how-it-works"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                location.pathname === "/how-it-works"
                  ? "bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
              }`}
            >
              How it Works
            </Link>
            <Link
              to="/about"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                location.pathname === "/about"
                  ? "bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
              }`}
            >
              About
            </Link>
            <Link
              to="/contact"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                location.pathname === "/contact"
                  ? "bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
              }`}
            >
              Contact
            </Link>
          </div>

          {/* Right Action Cluster */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={handleThemeToggle}
              className="w-10 h-10 grid place-items-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg"
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? "☀️" : "🌙"}
            </button>

            {/* Mode Switcher */}
            {isAuthenticated && (isDriver || isStudent) ? (
              <button
                onClick={(e) =>
                  handleModeSwitch(e, isDriver ? "/student" : "/driver")
                }
                className="text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-4 py-2 rounded-full transition-colors border border-emerald-100 dark:border-emerald-800"
              >
                {isDriver ? "🎒 Student Mode" : "🚗 Driver Mode"}
              </button>
            ) : null}

            {isAuthenticated ? (
              <>
                {/* Admin Panel Button */}
                {role === "ADMIN" && (
                  <Link
                    to="/admin"
                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200 font-bold py-2 px-4 rounded-full transition-all text-sm dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/60"
                  >
                    Admin Panel
                  </Link>
                )}

                {/* Profile Button */}
                <Link
                  to="/profile"
                  className="bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-900 dark:text-indigo-200 font-bold px-5 py-2 rounded-full transition-colors text-sm shadow-sm border border-indigo-100 dark:border-slate-700"
                >
                  My Profile
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 grid place-items-center rounded-full text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-100 dark:hover:border-rose-900 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              /* Sign In Button */
              <Link
                to="/login"
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded-full shadow-md transition-all active:scale-95"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button & dark mode toggle */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={handleThemeToggle}
              className="w-10 h-10 grid place-items-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg"
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? "☀️" : "🌙"}
            </button>
            <button
              onClick={toggleMenu}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 absolute w-full left-0 z-40">
          <div className="px-4 py-6 space-y-2 flex flex-col">
            <Link
              to="/"
              onClick={toggleMenu}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-3 rounded-xl text-base font-bold transition-colors"
            >
              Home
            </Link>
            <Link
              to="/forums"
              onClick={toggleMenu}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-3 rounded-xl text-base font-bold transition-colors"
            >
              Forums
            </Link>
            <Link
              to="/how-it-works"
              onClick={toggleMenu}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-3 rounded-xl text-base font-bold transition-colors"
            >
              How it Works
            </Link>
            <Link
              to="/about"
              onClick={toggleMenu}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-3 rounded-xl text-base font-bold transition-colors"
            >
              About
            </Link>
            <Link
              to="/contact"
              onClick={toggleMenu}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-3 rounded-xl text-base font-bold transition-colors"
            >
              Contact
            </Link>

            <button
              type="button"
              onClick={handleThemeToggle}
              className="flex items-center justify-between text-slate-600 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-3 rounded-xl text-base font-bold transition-colors text-left"
            >
              <span className="flex items-center gap-2">
                <span>{isDarkMode ? "☀️" : "🌙"}</span>
                <span>Appearance</span>
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {isDarkMode ? "Dark Mode" : "Light Mode"}
              </span>
            </button>

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-4 mx-4"></div>

            {/* Mobile Actions */}
            {isAuthenticated ? (
              <>
                {isDriver || isStudent ? (
                  <button
                    onClick={(e) =>
                      handleModeSwitch(e, isDriver ? "/student" : "/driver")
                    }
                    className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-4 py-3 rounded-xl text-base font-bold transition-colors mb-2 text-center border border-emerald-100 dark:border-emerald-800"
                  >
                    {isDriver
                      ? "🎒 Switch to Student Mode"
                      : "🚗 Switch to Driver Mode"}
                  </button>
                ) : null}

                {role === "ADMIN" && (
                  <Link
                    to="/admin"
                    onClick={toggleMenu}
                    className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-center font-bold px-4 py-3 rounded-xl text-base transition-all mb-2"
                  >
                    Admin Panel
                  </Link>
                )}

                <Link
                  to="/profile"
                  onClick={toggleMenu}
                  className="bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-900 dark:text-indigo-200 text-center font-bold px-4 py-3 rounded-xl text-base transition-colors border border-indigo-100 dark:border-slate-700"
                >
                  My Profile
                </Link>

                <button
                  onClick={() => {
                    toggleMenu();
                    handleLogout();
                  }}
                  className="text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-center font-bold px-4 py-3 rounded-xl text-base transition-colors mt-2 flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-900"
                >
                  <LogOut size={18} /> Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={toggleMenu}
                className="bg-teal-600 hover:bg-teal-700 text-white text-center font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
