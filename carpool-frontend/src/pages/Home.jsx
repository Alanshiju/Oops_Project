import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Home = () => {
  const [role, setRole] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalKmShared: 0,
    co2SavedKg: 0,
    moneySavedInr: 0,
  });

  // Fetch the role verified by the backend cookie
  useEffect(() => {
    fetch("http://localhost:7070/api/check-auth", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.isAuthenticated) {
          setRole(data.role);
        } else {
          setRole(null);
        }
      })
      .catch(() => setRole(null));

    fetch("http://localhost:7070/api/analytics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAnalytics(data);
        }
      })
      .catch((err) => console.error("Failed to load analytics", err));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-blue-900 text-white pt-20 pb-24 px-4 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <span className="bg-blue-800 text-blue-200 text-sm font-bold px-4 py-1 rounded-full mb-6 uppercase tracking-widest">
            Jyothi Engineering College Exclusive
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            Share the Drive. <br className="hidden md:block" />
            <span className="text-yellow-400">Save the Planet.</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-200 mb-10 max-w-2xl font-medium">
            The smart, secure, and eco-friendly carpool platform exclusively for
            our campus community. Find a ride or share your empty seats today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {/* Student action: If logged in as USER -> /student, else -> /login */}
            <Link
              to={role === "USER" ? "/student" : "/login"}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-10 rounded-xl shadow-lg transition-transform active:scale-95 text-lg"
            >
              Find a Ride
            </Link>

            {/* Driver action: If logged in as USER -> /driver, else -> /login */}
            <Link
              to={role === "USER" ? "/driver" : "/login"}
              className="bg-white hover:bg-slate-100 text-blue-900 font-bold py-4 px-10 rounded-xl shadow-lg transition-transform active:scale-95 text-lg"
            >
              Offer a Ride
            </Link>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="py-12 px-4 bg-emerald-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-emerald-100">
              Campus Environmental Impact
            </h2>
            <p className="text-emerald-300 text-sm">
              Real-time metrics powered by our community.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-emerald-800 p-6 rounded-xl border border-emerald-700 shadow-inner">
              <div className="text-4xl mb-2">🛣️</div>
              <div className="text-3xl font-extrabold">
                {analytics.totalKmShared.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}{" "}
                km
              </div>
              <div className="text-emerald-200 text-sm font-semibold uppercase tracking-wider mt-1">
                Total Distance Shared
              </div>
            </div>
            <div className="bg-emerald-800 p-6 rounded-xl border border-emerald-700 shadow-inner">
              <div className="text-4xl mb-2">🌿</div>
              <div className="text-3xl font-extrabold">
                {analytics.co2SavedKg.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}{" "}
                kg
              </div>
              <div className="text-emerald-200 text-sm font-semibold uppercase tracking-wider mt-1">
                CO₂ Prevented
              </div>
            </div>
            <div className="bg-emerald-800 p-6 rounded-xl border border-emerald-700 shadow-inner">
              <div className="text-4xl mb-2">💰</div>
              <div className="text-3xl font-extrabold">
                ₹
                {analytics.moneySavedInr.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="text-emerald-200 text-sm font-semibold uppercase tracking-wider mt-1">
                Est. Student Savings
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-blue-900 mb-4">
              Why use Campus Carpool?
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">
              Engineered specifically for students, prioritizing safety,
              efficiency, and real-time spatial matching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                🛡️
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                100% Verified Users
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Every driver and passenger is manually verified by college
                administrators using their official College ID before they can
                use the platform.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                📍
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Smart Route Matching
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Our backend spatial engine mathematically calculates driver
                routes and matches you only with cars passing directly through
                your area.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                🌱
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Eco-Friendly
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Reduce traffic congestion on campus and lower carbon emissions
                by filling empty seats. Split fuel costs and save money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-4 bg-slate-900 text-center text-white">
        <h2 className="text-3xl font-extrabold mb-6">Ready to hit the road?</h2>
        <Link
          to={role === "USER" ? "/student" : "/login"}
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors"
        >
          Join the Platform Now
        </Link>
      </section>
    </div>
  );
};

export default Home;
