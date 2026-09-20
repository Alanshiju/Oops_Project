import { Link } from "react-router-dom";

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-teal-900 dark:text-teal-400 mb-4 tracking-tight">
            How CampusPool Works
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Whether you're offering an empty seat or looking for a ride to
            class, getting started is simple, fast, and eco-friendly.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-16">
          {/* Passenger Flow */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl shadow-teal-100/50 dark:shadow-none border border-slate-100 dark:border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white font-bold px-6 py-2 rounded-bl-2xl text-sm uppercase tracking-wider">
              For Passengers
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-8 mt-4 flex items-center gap-3">
              <span className="text-3xl">🎒</span> Catch a Ride
            </h2>

            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-700 before:to-transparent">
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Scan Your Area
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Open the app and hit "Scan My Area". We'll use your GPS to
                    find drivers actively heading to campus near you.
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Book a Seat
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Tap a vehicle on the map to see driver details and instantly
                    request a seat.
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Track Live
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Once accepted, watch the driver approach in real-time on the
                    live map with accurate ETAs.
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Ride & Relax
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Hop in, enjoy the ride, and save money while reducing your
                    carbon footprint.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Driver Flow */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl shadow-teal-100/50 dark:shadow-none border border-slate-100 dark:border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-teal-600 text-white font-bold px-6 py-2 rounded-bl-2xl text-sm uppercase tracking-wider">
              For Drivers
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-8 mt-4 flex items-center gap-3">
              <span className="text-3xl">🚗</span> Offer a Ride
            </h2>

            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-700 before:to-transparent">
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-slate-700 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Set Your Route
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Plot your starting point on the map. We automatically
                    calculate the optimal route to the Jyothi campus.
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-slate-700 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Publish & Wait
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Hit publish. Your car instantly appears on the map for
                    students along your route.
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-slate-700 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Accept Peers
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Review incoming booking requests and accept passengers that
                    fit your schedule.
                  </p>
                </div>
              </div>
              <div className="relative flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm z-10 shrink-0 border-4 border-white dark:border-slate-800">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Drive & Earn
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                    Pick up your peers, head to class, and split the travel
                    costs seamlessly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            to="/login"
            className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-4 px-10 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            Join the Community Today
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
