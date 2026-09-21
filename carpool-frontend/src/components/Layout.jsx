import Navbar from "./Navbar";
import Footer from "./Footer";
import { Link } from "react-router-dom";

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar />
      <main className="flex-grow w-full">{children}</main>

      {/* Floating Quick Actions */}
      <div className="fixed bottom-20 right-4 sm:right-6 flex flex-col gap-3 z-40 items-end">
        <Link
          className="group flex items-center justify-start h-14 w-14 hover:w-36 px-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg rounded-full text-teal-600 dark:text-teal-400 transition-all duration-300 overflow-hidden"
          to="/student-dashboard"
        >
          <span className="text-xl flex-shrink-0 leading-none">🔍</span>
          <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-sm">
            Find a Ride
          </span>
        </Link>

        <Link
          className="group flex items-center justify-start h-14 w-14 hover:w-36 px-4 bg-teal-600/90 dark:bg-teal-500/90 backdrop-blur-md shadow-lg rounded-full text-white transition-all duration-300 overflow-hidden"
          to="/driver-dashboard"
        >
          <span className="text-xl flex-shrink-0 leading-none">🚗</span>
          <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-sm">
            Offer a Ride
          </span>
        </Link>
      </div>

      <Footer />
    </div>
  );
};

export default Layout;
