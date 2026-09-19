import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Home = () => {
  const [role, setRole] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalKmShared: 0,
    co2SavedKg: 0,
    moneySavedInr: 0,
  });

  useEffect(() => {
    fetch("http://localhost:7070/api/check-auth", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.isAuthenticated) setRole(data.role);
        else setRole(null);
      })
      .catch(() => setRole(null));

    fetch("http://localhost:7070/api/analytics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAnalytics(data);
      })
      .catch((err) => console.error("Failed to load analytics", err));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 overflow-x-hidden font-sans">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-indigo-900 to-indigo-950 text-white pt-24 pb-32 px-6 text-center shadow-xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl mix-blend-screen"></div>
          <div className="absolute top-32 -right-24 w-72 h-72 bg-indigo-500 rounded-full blur-3xl mix-blend-screen"></div>
        </div>

        <div className="relative max-w-5xl mx-auto flex flex-col items-center">
          <span className="bg-indigo-800/50 text-blue-200 border border-indigo-700/50 text-xs font-bold px-5 py-1.5 rounded-full mb-8 uppercase tracking-[0.2em] shadow-sm backdrop-blur-sm animate-fade-in-up">
            Campus Carpool Platform
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight drop-shadow-md animate-fade-in-up animation-delay-150">
            Share the Ride. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-400">
              Save the Campus.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-12 max-w-2xl font-medium drop-shadow-sm opacity-90 animate-fade-in-up animation-delay-300">
            The smart, secure, and eco-friendly carpool platform exclusively for
            our community. Find a ride or share your empty seats today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-fade-in-up animation-delay-450 z-10">
            <Link
              to={role === "USER" ? "/student" : "/login"}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-extrabold py-4 px-10 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 text-lg border border-emerald-400/50 hover:-translate-y-1"
            >
              Find a Ride
            </Link>

            <Link
              to={role === "USER" ? "/driver" : "/login"}
              className="bg-white/10 hover:bg-white/20 text-white font-extrabold py-4 px-10 rounded-2xl shadow-xl transition-all active:scale-95 text-lg backdrop-blur-md border border-white/20 hover:-translate-y-1"
            >
              Offer a Ride
            </Link>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="relative -mt-16 px-4 pb-12 z-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-slate-100 transform transition-transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/10 duration-300">
              <div className="w-14 h-14 mx-auto bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm">
                🌿
              </div>
              <div className="text-4xl font-extrabold text-slate-800 mb-1">
                {(analytics.co2SavedKg > 0
                  ? analytics.co2SavedKg
                  : 500
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                + kg
              </div>
              <div className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                CO₂ Saved
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-slate-100 transform transition-transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/10 duration-300">
              <div className="w-14 h-14 mx-auto bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm">
                👥
              </div>
              <div className="text-4xl font-extrabold text-slate-800 mb-1">
                120+
              </div>
              <div className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                Active Users
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-slate-100 transform transition-transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/10 duration-300">
              <div className="w-14 h-14 mx-auto bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm">
                🚗
              </div>
              <div className="text-4xl font-extrabold text-slate-800 mb-1">
                50+
              </div>
              <div className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                Daily Rides
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-16 tracking-tight">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-3xl shadow-sm border border-slate-100 mb-6 text-indigo-500 font-black">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Sign Up & Verify
              </h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Join the platform using your official college credentials. We
                ensure a trusted and safe community.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-3xl shadow-sm border border-slate-100 mb-6 text-indigo-500 font-black">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Find or Offer
              </h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Post your daily commute to share seats, or search for fellow
                students heading your way.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-3xl shadow-sm border border-slate-100 mb-6 text-indigo-500 font-black">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Ride Together
              </h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Connect, share the travel costs, reduce campus traffic, and
                lower your carbon footprint.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-slate-900 text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">
          Ready to hit the road?
        </h2>
        <Link
          to={role ? "/profile" : "/login"}
          className="inline-block bg-white hover:bg-slate-100 text-slate-900 font-extrabold py-4 px-12 rounded-full shadow-xl transition-transform active:scale-95 text-lg"
        >
          Get Started Now
        </Link>
      </section>
    </div>
  );
};

export default Home;
