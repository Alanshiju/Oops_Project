import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleLogout = () => {
    document.cookie = "jwt=; Max-Age=0; path=/";
    navigate("/login");
  };

  const isDriver = location.pathname.includes("/driver");
  const isStudent = location.pathname.includes("/student");

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <span className="font-extrabold text-2xl tracking-tight text-indigo-950 hover:text-indigo-700 transition-colors">
              CAMPUS<span className="text-emerald-500">POOL</span>
            </span>
          </Link>

          {/* Desktop Center Menu - Pill Container */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/50 rounded-full p-1.5 border border-slate-200/50">
            <Link
              to="/"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${location.pathname === "/" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"}`}
            >
              Home
            </Link>
            <Link
              to="/how-it-works"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${location.pathname === "/how-it-works" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"}`}
            >
              How it Works
            </Link>
            <Link
              to="/about"
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${location.pathname === "/about" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"}`}
            >
              About
            </Link>
          </div>

          {/* Right Action Cluster */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Mode Switcher */}
            {isDriver || isStudent ? (
              <Link
                to={isDriver ? "/student" : "/driver"}
                className="text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full transition-colors border border-emerald-100"
              >
                {isDriver ? "🎒 Student Mode" : "🚗 Driver Mode"}
              </Link>
            ) : null}

            {/* Profile Button */}
            <Link
              to="/profile"
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold px-5 py-2 rounded-full transition-colors text-sm shadow-sm border border-indigo-100"
            >
              My Profile
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-10 h-10 grid place-items-center rounded-full text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="p-2 rounded-full text-slate-500 hover:text-indigo-900 hover:bg-slate-100 transition-colors focus:outline-none"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-xl shadow-slate-200/50 absolute w-full left-0 z-40">
          <div className="px-4 py-6 space-y-2 flex flex-col">
            <Link to="/" onClick={toggleMenu} className="text-slate-600 hover:text-indigo-900 hover:bg-slate-50 px-4 py-3 rounded-xl text-base font-bold transition-colors">Home</Link>
            <Link to="/how-it-works" onClick={toggleMenu} className="text-slate-600 hover:text-indigo-900 hover:bg-slate-50 px-4 py-3 rounded-xl text-base font-bold transition-colors">How it Works</Link>
            <Link to="/about" onClick={toggleMenu} className="text-slate-600 hover:text-indigo-900 hover:bg-slate-50 px-4 py-3 rounded-xl text-base font-bold transition-colors">About</Link>
            
            <div className="h-px bg-slate-100 my-4 mx-4"></div>

            {/* Mobile Actions */}
            {isDriver || isStudent ? (
              <Link
                to={isDriver ? "/student" : "/driver"}
                onClick={toggleMenu}
                className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-3 rounded-xl text-base font-bold transition-colors mb-2 text-center border border-emerald-100"
              >
                {isDriver ? "🎒 Switch to Student Mode" : "🚗 Switch to Driver Mode"}
              </Link>
            ) : null}

            <Link
              to="/profile"
              onClick={toggleMenu}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-center font-bold px-4 py-3 rounded-xl text-base transition-colors border border-indigo-100"
            >
              My Profile
            </Link>

            <button
              onClick={() => { toggleMenu(); handleLogout(); }}
              className="text-rose-600 bg-white hover:bg-rose-50 text-center font-bold px-4 py-3 rounded-xl text-base transition-colors mt-2 flex items-center justify-center gap-2 border border-rose-100"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
