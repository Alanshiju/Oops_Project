import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { API_BASE_URL } from "../config/api";

// Fix Leaflet default marker icon paths for bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const Home = () => {
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [analytics, setAnalytics] = useState({
    totalKmShared: 0,
    co2SavedKg: 0,
    moneySavedInr: 0,
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-auth`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.isAuthenticated) {
          setRole(data.role);
          setIsAuthenticated(true);
          setProfileName(data.name || "User");
        } else {
          setRole(null);
          setIsAuthenticated(false);
        }
      })
      .catch(() => setRole(null));

    fetch(`${API_BASE_URL}/api/analytics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAnalytics(data);
      })
      .catch((err) => console.error("Failed to load analytics", err));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-x-hidden font-sans transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6 text-center shadow-xl">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1920&q=80"
            alt="Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-white/85 dark:bg-slate-900/90 backdrop-blur-md"></div>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          <span className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold px-5 py-1.5 rounded-full mb-8 uppercase tracking-[0.2em] shadow-sm backdrop-blur-sm animate-fade-in-up">
            Campus Carpool Platform
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-teal-950 dark:text-white mb-6 leading-tight tracking-tight drop-shadow-sm animate-fade-in-up animation-delay-150">
            Share the Ride. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-400">
              Save the Campus.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-12 max-w-2xl font-medium drop-shadow-sm opacity-90 animate-fade-in-up animation-delay-300">
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
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl shadow-indigo-900/5 dark:shadow-black/30 border border-slate-100 dark:border-slate-700 transform transition-transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/10 duration-300">
              <div className="w-14 h-14 mx-auto bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm">
                🌿
              </div>
              <div className="text-4xl font-extrabold text-slate-800 dark:text-white mb-1">
                {(analytics.co2SavedKg > 0
                  ? analytics.co2SavedKg
                  : 500
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                + kg
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">
                CO₂ Saved
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl shadow-indigo-900/5 dark:shadow-black/30 border border-slate-100 dark:border-slate-700 transform transition-transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/10 duration-300">
              <div className="w-14 h-14 mx-auto bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm">
                👥
              </div>
              <div className="text-4xl font-extrabold text-slate-800 dark:text-white mb-1">
                120+
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">
                Active Users
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl shadow-indigo-900/5 dark:shadow-black/30 border border-slate-100 dark:border-slate-700 transform transition-transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-900/10 duration-300">
              <div className="w-14 h-14 mx-auto bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm">
                🚗
              </div>
              <div className="text-4xl font-extrabold text-slate-800 dark:text-white mb-1">
                50+
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">
                Daily Rides
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Published Rides Viewer */}
      {isAuthenticated && <PublishedRidesViewer />}

      {/* How it Works */}
      <section className="py-20 px-6 bg-white dark:bg-slate-900/40">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white mb-16 tracking-tight">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 text-indigo-500 dark:text-teal-400 font-black">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
                Sign Up & Verify
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                Join the platform using your official college credentials. We
                ensure a trusted and safe community.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 text-indigo-500 dark:text-teal-400 font-black">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
                Find or Offer
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                Post your daily commute to share seats, or search for fellow
                students heading your way.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 text-indigo-500 dark:text-teal-400 font-black">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
                Ride Together
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
                Connect, share the travel costs, reduce campus traffic, and
                lower your carbon footprint.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-slate-900 dark:bg-slate-950 text-center">
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

// React Error Boundary to catch any Leaflet / Map rendering failures safely
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Map rendering error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 mt-3">
          Unable to display route map.
        </div>
      );
    }
    return this.props.children;
  }
}

const RoutePreviewMap = ({ ride, routeGeometry }) => {
  const mapContainer = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    let map = null;

    try {
      // Initialize map
      map = L.map(mapContainer.current, {
        attributionControl: false,
      }).setView([10.7329, 76.2713], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Invalidate size once container becomes visible
      const timer = setTimeout(() => {
        if (map) {
          try {
            map.invalidateSize();
          } catch (e) {}
        }
      }, 100);

      // Draw the pre-calculated static route
      try {
        const rawGeom =
          ride?.routeGeometry || ride?.route_geometry || routeGeometry;

        let latLngs = null;
        if (rawGeom) {
          if (typeof rawGeom === "string") {
            latLngs = JSON.parse(rawGeom);
          } else if (Array.isArray(rawGeom)) {
            latLngs = rawGeom;
          }
        }

        if (latLngs && latLngs.length > 0) {
          // Normalize coordinate structures to [lat, lng]
          const formattedLatLngs = latLngs
            .map((pt) => {
              if (Array.isArray(pt)) return [Number(pt[0]), Number(pt[1])];
              if (pt && typeof pt === "object") {
                const lat = pt.lat !== undefined ? pt.lat : pt.latitude;
                const lng = pt.lng !== undefined ? pt.lng : pt.longitude;
                return [Number(lat), Number(lng)];
              }
              return null;
            })
            .filter(
              (pt) =>
                pt &&
                !isNaN(pt[0]) &&
                !isNaN(pt[1]) &&
                (pt[0] !== 0 || pt[1] !== 0),
            );

          if (formattedLatLngs.length > 0) {
            const polyline = L.polyline(formattedLatLngs, {
              color: "#0d9488",
              weight: 5,
            }).addTo(map);

            map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

            // Add start and end markers
            L.marker(formattedLatLngs[0]).addTo(map).bindPopup("Start");
            L.marker(formattedLatLngs[formattedLatLngs.length - 1])
              .addTo(map)
              .bindPopup("Jyothi Engineering College");
          }
        }
      } catch (err) {
        console.error("Failed to parse route geometry", err);
      }

      return () => {
        clearTimeout(timer);
        if (map) {
          try {
            map.remove();
          } catch (err) {
            console.error("Error removing map instance:", err);
          }
        }
      };
    } catch (err) {
      console.error("Failed to initialize route map:", err);
    }

    // Strict cleanup
    return () => {
      if (map) {
        try {
          map.remove();
        } catch (err) {
          console.error("Error removing map instance:", err);
        }
      }
    };
  }, [ride, routeGeometry]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 mt-3 z-0 shadow-inner"
    />
  );
};

const PublishedRidesViewer = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRideIds, setExpandedRideIds] = useState({});

  const ridesPerPage = 6;

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rides/search`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setRides(data);
        }
      })
      .catch((err) => console.error("Error loading published rides:", err))
      .finally(() => setLoading(false));
  }, []);

  const toggleRouteMap = (rideId) => {
    setExpandedRideIds((prev) => ({
      ...prev,
      [rideId]: !prev[rideId],
    }));
  };

  const totalPages = Math.ceil(rides.length / ridesPerPage) || 1;
  const currentRides = rides.slice(
    (currentPage - 1) * ridesPerPage,
    currentPage * ridesPerPage,
  );

  return (
    <section className="py-16 px-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Live Network
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-teal-950 dark:text-white mt-3 tracking-tight">
              Published Rides
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 font-medium">
              Browse current routes published by drivers heading across campus.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {rides.length} {rides.length === 1 ? "Active Ride" : "Active Rides"}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-1/3"></div>
                  </div>
                </div>
                <div className="h-16 bg-slate-100 dark:bg-slate-700/60 rounded-2xl"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
            <div className="text-4xl mb-3">🚗</div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
              No Published Rides Available
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              There are currently no active routes published. Check back soon or
              offer your own ride!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {currentRides.map((ride) => {
                const isExpanded = !!expandedRideIds[ride.rideId];
                const driverInitial = ride.driverName
                  ? ride.driverName.charAt(0).toUpperCase()
                  : "D";

                return (
                  <div
                    key={ride.rideId}
                    className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Driver & Status */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                            {driverInitial}
                          </div>
                          <div className="truncate">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                              {ride.driverName || "Driver"}
                            </h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Ride #{ride.rideId}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                            ride.status === "IN_TRANSIT"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300"
                          }`}
                        >
                          {ride.status === "IN_TRANSIT"
                            ? "In Transit"
                            : "Scheduled"}
                        </span>
                      </div>

                      {/* Vehicle & Info */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700 mb-4 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400 font-medium">
                            Vehicle
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2">
                            {ride.vehicleMake || ride.vehicleModel
                              ? `${ride.vehicleMake || ""} ${ride.vehicleModel || ""}`.trim()
                              : "Standard Car"}
                            {ride.licensePlate ? ` • ${ride.licensePlate}` : ""}
                          </span>
                        </div>
                        {ride.carColor && (
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span className="text-slate-400 font-medium">
                              Color
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                              {ride.carColor}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400 font-medium">
                            Distance
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {ride.distanceKm
                              ? `${ride.distanceKm.toFixed(1)} km`
                              : "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Seats & Fare */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 p-3 rounded-2xl text-center">
                          <span className="block text-[10px] uppercase font-bold text-teal-700 dark:text-teal-300 tracking-wider">
                            Seats
                          </span>
                          <span className="font-extrabold text-teal-950 dark:text-teal-200 text-sm">
                            {ride.availableSeats} available
                          </span>
                        </div>
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-2xl text-center">
                          <span className="block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">
                            Fare
                          </span>
                          <span className="font-extrabold text-emerald-950 dark:text-emerald-200 text-sm">
                            {ride.isFreeRide
                              ? "FREE"
                              : `₹${ride.costPerSeat || 0}`}
                          </span>
                        </div>
                      </div>

                      {/* Route Map Preview */}
                      {isExpanded && (
                        <MapErrorBoundary>
                          <RoutePreviewMap ride={ride} />
                        </MapErrorBoundary>
                      )}
                    </div>

                    {/* View Route Map Button */}
                    <button
                      type="button"
                      onClick={() => toggleRouteMap(ride.rideId)}
                      className={`w-full mt-4 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 ${
                        isExpanded
                          ? "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
                          : "bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20"
                      }`}
                    >
                      <span>
                        {isExpanded ? "Hide Route Map" : "View Route Map"}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 px-3">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Home;
