import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const pulsingDot = L.divIcon({
  className: "custom-div-icon",
  html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const carIcon = L.divIcon({
  className: "custom-div-icon",
  html: '<div class="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white shadow-lg"><span class="text-white text-xs">🚗</span></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const HistoricalMapView = ({ routeGeometry }) => {
  const histMapRef = useRef(null);
  const histMapInstance = useRef(null);

  useEffect(() => {
    if (!histMapRef.current || !routeGeometry || routeGeometry.length < 2)
      return;

    if (!histMapInstance.current) {
      histMapInstance.current = L.map(histMapRef.current).setView(
        [10.5276, 76.2144],
        12,
      );
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        attribution: "© OpenStreetMap contributors",
      }).addTo(histMapInstance.current);
    }

    const latlngs = routeGeometry.map((c) => [c.lat, c.lng]);
    const polyline = L.polyline(latlngs, {
      color: "gray",
      weight: 4,
    }).addTo(histMapInstance.current);
    histMapInstance.current.fitBounds(polyline.getBounds(), {
      padding: [30, 30],
    });

    return () => {
      polyline.remove();
      if (histMapInstance.current) {
        histMapInstance.current.remove();
        histMapInstance.current = null;
      }
    };
  }, [routeGeometry]);

  if (!routeGeometry || routeGeometry.length < 2) {
    return (
      <div className="text-sm text-slate-400 italic p-4">
        No route data available for this ride.
      </div>
    );
  }

  return (
    <div
      ref={histMapRef}
      className="w-full h-[300px] rounded-lg border-2 border-slate-200 mt-3"
    ></div>
  );
};

const RoutePreviewMap = ({ routeGeometry }) => {
  const previewMapRef = useRef(null);
  const previewMapInstance = useRef(null);

  useEffect(() => {
    if (!previewMapRef.current || !routeGeometry || routeGeometry.length < 2)
      return;

    if (!previewMapInstance.current) {
      previewMapInstance.current = L.map(previewMapRef.current).setView(
        [10.5276, 76.2144],
        12,
      );
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        attribution: "© OpenStreetMap contributors",
      }).addTo(previewMapInstance.current);
    }

    // Fix gray tiles from hidden container expansion
    setTimeout(() => {
      if (previewMapInstance.current)
        previewMapInstance.current.invalidateSize();
    }, 100);

    const latlngs = routeGeometry.map((c) => [c.lat, c.lng]);
    const polyline = L.polyline(latlngs, {
      color: "#2563eb",
      weight: 4,
      dashArray: "8, 8",
    }).addTo(previewMapInstance.current);
    previewMapInstance.current.fitBounds(polyline.getBounds(), {
      padding: [30, 30],
    });

    return () => {
      polyline.remove();
      if (previewMapInstance.current) {
        previewMapInstance.current.remove();
        previewMapInstance.current = null;
      }
    };
  }, [routeGeometry]);

  if (!routeGeometry || routeGeometry.length < 2) {
    return (
      <div className="text-sm text-slate-400 italic p-4">
        No route preview available.
      </div>
    );
  }

  return (
    <div
      ref={previewMapRef}
      className="w-full h-[250px] rounded-lg border-2 border-slate-200 mt-3"
    ></div>
  );
};

const RideCardSkeleton = () => (
  <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex justify-between items-center w-full animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
      <div className="flex flex-col gap-2">
        <div className="h-5 bg-slate-200 rounded w-32"></div>
        <div className="h-3 bg-slate-200 rounded w-48"></div>
        <div className="h-4 bg-slate-200 rounded w-24 mt-1"></div>
      </div>
    </div>
    <div className="w-28 h-12 bg-slate-200 rounded-lg"></div>
  </div>
);

const StudentDashboard = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const hasInitialZoom = useRef(false);

  const [rides, setRides] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState(
    "Click to find drivers passing by your location.",
  );
  const [activeTab, setActiveTab] = useState("search");
  const [activeRideId, setActiveRideId] = useState(null);
  const [driverId, setDriverId] = useState(null);
  const [liveRideStatus, setLiveRideStatus] = useState("PENDING");
  const [distanceKm, setDistanceKm] = useState(0);

  // Chat & SOS States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const wsRef = useRef(null);
  const watchIdRef = useRef(null);

  const [currentGps, setCurrentGps] = useState(null);
  const routePolylineRef = useRef(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [expandedBookingId, setExpandedBookingId] = useState(null);
  const [expandedRouteRideId, setExpandedRouteRideId] = useState(null);

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const activeStatusRef = useRef("PENDING");

  const fetchMyBookings = () => {
    fetch("http://localhost:7070/api/bookings/my-rides", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMyBookings(data);
          const activeBooking = data.find((b) =>
            ["PENDING", "ACCEPTED", "DRIVER_ARRIVED", "IN_TRANSIT"].includes(
              b.status?.toUpperCase(),
            ),
          );
          setActiveRideId(activeBooking ? activeBooking.rideId : null);
          if (activeBooking) {
            setLiveRideStatus(activeBooking.status);
            activeStatusRef.current = activeBooking.status;
            setDriverId(activeBooking.driverId);
          } else {
            setDriverId(null);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch bookings", err));
  };

  useEffect(() => {
    watchIdRef.current = null;

    if (activeRideId) {
      if (!mapInstance.current && mapRef.current) {
        mapInstance.current = L.map(mapRef.current).setView(
          [10.5276, 76.2144],
          12,
        );
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstance.current);
      }

      // Continuous passenger tracking
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const userPos = [
              position.coords.latitude,
              position.coords.longitude,
            ];
            setCurrentGps({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            if (!userMarkerRef.current && mapInstance.current) {
              userMarkerRef.current = L.marker(userPos, {
                icon: pulsingDot,
              }).addTo(mapInstance.current);
            } else if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng(userPos);
            }

            fetch(`http://localhost:7070/api/location/update`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }),
            }).catch((err) =>
              console.error("Error pushing student location:", err),
            );
          },
          (err) => console.error("Error in watchPosition", err),
          { enableHighAccuracy: true, maximumAge: 10000 },
        );
      }

      // Task 2 & Constraint 3: Student Route Projection - Fetch live ride details and project routeGeometry
      fetch(`http://localhost:7070/api/rides/${activeRideId}/live`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.routeGeometry && data.routeGeometry.length >= 2) {
            if (mapInstance.current) {
              if (routePolylineRef.current) {
                routePolylineRef.current.remove();
                routePolylineRef.current = null;
              }
              const latlngs = data.routeGeometry.map((c) => [c.lat, c.lng]);
              routePolylineRef.current = L.polyline(latlngs, {
                color: "#2563eb",
                weight: 5,
                opacity: 0.8,
                dashArray: "10, 10",
              }).addTo(mapInstance.current);
              mapInstance.current.fitBounds(
                routePolylineRef.current.getBounds(),
                {
                  padding: [40, 40],
                },
              );
            }
          }
        })
        .catch((err) =>
          console.error("Error fetching live ride geometry:", err),
        );

      // Initialize native WebSocket connection for live driver updates
      wsRef.current = new WebSocket(
        `ws://localhost:7070/ws/rides/${activeRideId}/live`,
      );

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data && data.type === "STATUS_UPDATE") {
            setLiveRideStatus(data.status);
            activeStatusRef.current = data.status;
            if (data.status === "COMPLETED") {
              // Hard teardown: kill GPS, close WS, remove driver marker
              if (watchIdRef.current !== null && "geolocation" in navigator) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
              if (driverMarkerRef.current) {
                driverMarkerRef.current.remove();
                driverMarkerRef.current = null;
              }
              setEtaMinutes(null);
              setActiveRideId(null);
              setDriverId(null);
              setLiveRideStatus("PENDING");
              activeStatusRef.current = "PENDING";
              fetchMyBookings();
            }
            return;
          } else if (data && data.type === "CHAT_MESSAGE") {
            setChatMessages((prev) => [...prev, data]);
            return;
          } else if (data && data.type === "SOS_ALERT") {
            alert("🚨 SOS EMERGENCY TRIGGERED FOR THIS RIDE!");
            return;
          } else if (data && data.type === "BOOKING_ACCEPTED") {
            alert("✅ Driver accepted your booking!");
            fetchMyBookings();
            return;
          } else if (data && data.type === "BOOKING_REJECTED") {
            alert("❌ Driver rejected your booking. Please find another ride.");
            setMyBookings([]);
            setActiveRideId(null);
            setActiveTab("search");
            return;
          } else if (data && data.type === "DRIVER_CANCELLED") {
            alert("⚠️ The driver has canceled this ride.");
            setMyBookings([]);
            setActiveRideId(null);
            setActiveTab("search");
            return;
          } else if (data && data.type === "DRIVER_ARRIVED") {
            alert("📍 Driver has arrived at your pickup location!");
            return;
          }

          if (data && data.type === "TELEMETRY_UPDATE") {
            const currentStatus = activeStatusRef.current;
            if (
              currentStatus === "PENDING" ||
              currentStatus === "COMPLETED" ||
              currentStatus === "CANCELLED"
            ) {
              return;
            }

            // Task 3: Capture live ETA in minutes
            if (data.eta_minutes !== undefined && data.eta_minutes !== null) {
              setEtaMinutes(data.eta_minutes);
            }

            const newPos = [data.lat, data.lng];

            if (!driverMarkerRef.current) {
              if (mapInstance.current) {
                driverMarkerRef.current = L.marker(newPos, {
                  icon: carIcon,
                }).addTo(mapInstance.current);
              }
            } else {
              driverMarkerRef.current.setLatLng(newPos);
            }

            // Only auto-zoom on the very first update
            if (!hasInitialZoom.current && mapInstance.current) {
              if (userMarkerRef.current && driverMarkerRef.current) {
                const group = new L.featureGroup([
                  userMarkerRef.current,
                  driverMarkerRef.current,
                ]);
                mapInstance.current.fitBounds(group.getBounds(), {
                  padding: [50, 50],
                });
              } else {
                mapInstance.current.setView(newPos, 14);
              }
              hasInitialZoom.current = true;
            }
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      // Fetch initial chat history
      fetch(`http://localhost:7070/api/rides/${activeRideId}/chat`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setChatMessages(data))
        .catch((err) => console.error(err));
    }

    return () => {
      // Constraint 3: Prevent polyline memory leaks
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      setEtaMinutes(null);
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        driverMarkerRef.current = null;
        userMarkerRef.current = null;
      }
      hasInitialZoom.current = false;
    };
  }, [activeRideId]);

  const handleRefocusMap = () => {
    if (mapInstance.current) {
      const markers = [];
      if (userMarkerRef.current) markers.push(userMarkerRef.current);
      if (driverMarkerRef.current) markers.push(driverMarkerRef.current);
      if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        mapInstance.current.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }
  };

  useEffect(() => {
    if (activeTab === "search" && activeRideId && mapInstance.current) {
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize();
        }
      }, 50);
    }
  }, [activeTab, activeRideId]);

  const handleSearchRides = () => {
    setIsSearching(true);
    setSearchStatus("Acquiring satellite GPS lock...");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const studentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentGps(studentLocation);

          setSearchStatus("Calculating spatial matches on server...");

          fetch("http://localhost:7070/api/rides/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(studentLocation),
          })
            .then((res) => res.json())
            .then((data) => {
              setIsSearching(false);
              setRides(data);
              if (data.length === 0) {
                setSearchStatus(
                  "No rides are passing through your immediate area right now.",
                );
              } else {
                setSearchStatus(
                  `Found ${data.length} ride(s) heading to campus near you!`,
                );
              }
            })
            .catch((err) => {
              console.error(err);
              setIsSearching(false);
              setSearchStatus("Error connecting to the carpool server.");
            });
        },
        (error) => {
          setIsSearching(false);
          setSearchStatus(
            "Failed to get your location. Please enable GPS permissions.",
          );
        },
        { enableHighAccuracy: true },
      );
    } else {
      setIsSearching(false);
      setSearchStatus("Geolocation is not supported by your browser.");
    }
  };

  const handleBookSeat = (rideId) => {
    fetch("http://localhost:7070/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // FIXED: Must be outside headers
      body: JSON.stringify({ rideId: rideId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          fetchMyBookings();
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  const handleCancelBooking = () => {
    fetch("http://localhost:7070/api/bookings/cancel", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          setMyBookings([]);
          setActiveRideId(null);
          setActiveTab("search");
        } else alert("❌ " + data.error);
      });
  };

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || !activeRideId) return;

    const msg = {
      type: "CHAT_MESSAGE",
      senderId: -1,
      senderName: "Student",
      targetUserId: driverId,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    wsRef.current.send(JSON.stringify(msg));
    setChatInput("");
  };

  const handleSos = () => {
    const rideIdToUse =
      activeRideId || (myBookings.length > 0 ? myBookings[0].rideId : null);
    if (!rideIdToUse || !navigator.geolocation) return;

    if (
      !window.confirm(
        "🚨 Are you sure you want to trigger an SOS Emergency Alert? This will notify administration immediately.",
      )
    )
      return;

    navigator.geolocation.getCurrentPosition((pos) => {
      fetch(`http://localhost:7070/api/rides/${rideIdToUse}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.message) toast.success(data.message);
          else toast.error(data.error);
        });
    });
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-6 max-w-7xl mx-auto p-4 w-full">
      <div className="flex gap-4 mb-6 w-full">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 py-3 font-bold rounded-lg transition-colors shadow ${activeTab === "search" ? "bg-blue-900 text-white" : "bg-white text-blue-900 border border-slate-200 hover:bg-slate-50"}`}
        >
          Find a Ride
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 font-bold rounded-lg transition-colors shadow ${activeTab === "history" ? "bg-blue-900 text-white" : "bg-white text-blue-900 border border-slate-200 hover:bg-slate-50"}`}
        >
          Previous Bookings
        </button>
      </div>

      <div
        style={{
          display: activeTab === "search" ? "block" : "none",
          width: "100%",
        }}
      >
        {/* Pinned Active Booking Card + Live Tracking */}
        {(() => {
          const activeBooking = myBookings.find((b) =>
            ["PENDING", "ACCEPTED", "DRIVER_ARRIVED", "IN_TRANSIT"].includes(
              b.status,
            ),
          );
          if (!activeBooking) return null;
          return (
            <div className="w-full mb-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-white/80 backdrop-blur-xl border-l-8 border-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-900/10 p-5 flex justify-between items-center border border-white/40">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-800">
                      Active: {activeBooking.driverName}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                        activeBooking.status === "IN_TRANSIT"
                          ? "bg-blue-100 text-blue-800"
                          : activeBooking.status === "DRIVER_ARRIVED"
                            ? "bg-amber-100 text-amber-800"
                            : activeBooking.status === "ACCEPTED"
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {activeBooking.status === "IN_TRANSIT"
                        ? "🚗 "
                        : activeBooking.status === "DRIVER_ARRIVED"
                          ? "📍 "
                          : activeBooking.status === "ACCEPTED"
                            ? "✅ "
                            : "⏳ "}
                      {activeBooking.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Ride #{activeBooking.rideId} &bull;{" "}
                    {activeBooking.vehicleColor || ""}{" "}
                    {activeBooking.vehicleMake || ""}{" "}
                    {activeBooking.vehicleModel || ""} &bull;{" "}
                    {activeBooking.licensePlate || "N/A"}
                  </p>
                </div>
                <button
                  onClick={handleCancelBooking}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-5 rounded-lg shadow text-sm transition active:scale-95"
                >
                  Cancel Booking
                </button>
              </motion.div>

              {/* Live Tracking Map */}
              {activeRideId && (
                <div className="bg-white p-5 rounded-xl shadow-md border border-slate-200 mt-3">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-bold text-blue-900">
                      Live Tracking
                    </h3>
                    <div className="flex items-center gap-2">
                      {liveRideStatus === "DRIVER_ARRIVED" && (
                        <div className="bg-amber-100 text-amber-800 border border-amber-500 font-bold px-3 py-1 rounded text-xs">
                          📍 Driver Arrived
                        </div>
                      )}
                      {liveRideStatus === "IN_TRANSIT" && (
                        <div className="bg-blue-100 text-blue-800 border border-blue-500 font-bold px-3 py-1 rounded flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>{" "}
                          In Transit
                        </div>
                      )}
                      {etaMinutes !== null &&
                        liveRideStatus !== "COMPLETED" && (
                          <div className="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-3 py-1 rounded text-xs flex items-center gap-1 animate-pulse">
                            ⏱️ ~{etaMinutes} mins
                          </div>
                        )}
                    </div>
                  </div>
                  <div className="relative w-full">
                    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleRefocusMap}
                        className="bg-white px-3 py-1.5 rounded shadow font-bold text-blue-900 hover:bg-slate-50 border border-slate-200 text-xs active:scale-95"
                      >
                        Refocus
                      </button>
                      <button
                        type="button"
                        onClick={handleSos}
                        className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded shadow font-bold text-white text-xs active:scale-95 animate-pulse"
                      >
                        🚨 SOS
                      </button>
                    </div>
                    <div
                      ref={mapRef}
                      className="w-full h-[45vh] lg:h-[650px] rounded-[2rem] overflow-hidden shadow-2xl shadow-indigo-900/20 z-0"
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Scan My Area Hero Card */}
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full border border-slate-200 text-center mb-8">
          <h2 className="text-3xl font-extrabold text-blue-900 mb-4">
            Find a Ride to Campus
          </h2>
          <p className="text-slate-600 mb-6 font-medium">{searchStatus}</p>

          <button
            onClick={handleSearchRides}
            disabled={isSearching}
            className={`px-8 py-4 rounded-xl font-extrabold text-white transform transition-transform active:scale-95 flex items-center justify-center gap-3 ${
              isSearching
                ? "bg-indigo-400 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg shadow-md"
            }`}
          >
            {isSearching ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Scanning Route Data...
              </>
            ) : "Scan My Area for Rides"}
          </button>
        </div>

        {/* Available Rides List */}
        <div className="w-full flex flex-col gap-4">
          {isSearching ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <RideCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            rides.map((ride) => {
              const hasActiveBooking = myBookings.some((b) =>
                [
                  "PENDING",
                  "ACCEPTED",
                  "DRIVER_ARRIVED",
                  "IN_TRANSIT",
                ].includes(b.status),
              );
              return (
                <div
                  key={ride.rideId}
                  className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden"
                >
                  <div className="p-6 hover:shadow-lg transition-shadow flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xl uppercase shadow-inner">
                        {ride.driverName ? ride.driverName.charAt(0) : "D"}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">
                          {ride.driverName || "Driver"}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                          <span>
                            {ride.carColor || ""}{" "}
                            {ride.vehicleMake || "Unknown"}{" "}
                            {ride.vehicleModel || "Vehicle"}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-700 tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                            {ride.licensePlate || "N/A"}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full font-bold">
                            {ride.availableSeats} Seats Left
                          </span>
                          <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">
                            {ride.distanceKm} km
                          </span>
                          {ride.isFreeRide || ride.costPerSeat === 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-bold">
                              🌱 Free Ride
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
                              ₹{ride.costPerSeat}/seat
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {hasActiveBooking ? (
                        <div
                          className="bg-slate-200 text-slate-500 font-bold py-3 px-6 rounded-lg text-sm cursor-not-allowed"
                          title="Cancel active booking to book another ride"
                        >
                          Booking Active
                        </div>
                      ) : (
                        <button
                          onClick={() => handleBookSeat(ride.rideId)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95"
                        >
                          Book Seat
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setExpandedRouteRideId(
                            expandedRouteRideId === ride.rideId
                              ? null
                              : ride.rideId,
                          )
                        }
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold underline"
                      >
                        {expandedRouteRideId === ride.rideId
                          ? "Hide Route"
                          : "View Route"}
                      </button>
                    </div>
                  </div>
                  {expandedRouteRideId === ride.rideId && (
                    <div className="border-t border-slate-100 px-6 pb-5">
                      <RoutePreviewMap routeGeometry={ride.routeGeometry} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        style={{ display: activeTab === "history" ? "flex" : "none" }}
        className="w-full flex-col gap-4"
      >
        {(() => {
          const pastBookings = myBookings.filter((b) =>
            ["COMPLETED", "CANCELLED", "REJECTED"].includes(
              String(b.status).toUpperCase(),
            ),
          );
          if (pastBookings.length === 0) {
            return (
              <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center text-slate-500 font-medium">
                No previous rides to show.
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-3">
              {pastBookings.map((booking) => (
                <div
                  key={booking.bookingId}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  {/* Accordion Header */}
                  <button
                    onClick={() =>
                      setExpandedBookingId(
                        expandedBookingId === booking.bookingId
                          ? null
                          : booking.bookingId,
                      )
                    }
                    className="w-full p-5 flex justify-between items-center hover:bg-slate-50 transition-colors text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-slate-700">
                          {booking.driverName}
                        </h4>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                            booking.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {booking.status === "COMPLETED" ? "🏁 " : "✕ "}
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {booking.departureTime
                          ? new Date(booking.departureTime).toLocaleString()
                          : `Booking #${booking.bookingId}`}{" "}
                        &bull;{" "}
                        {booking.isFreeRide
                          ? "🌱 Free Ride"
                          : `₹${booking.costPerSeat || 0}`}
                        {booking.distanceKm
                          ? ` • ${booking.distanceKm} km`
                          : ""}
                      </p>
                    </div>
                    <span className="text-slate-400 text-lg ml-4">
                      {expandedBookingId === booking.bookingId ? "▲" : "▼"}
                    </span>
                  </button>

                  {/* Accordion Expanded Content */}
                  {expandedBookingId === booking.bookingId && (
                    <div className="border-t border-slate-100 px-5 pb-5">
                      {/* Vehicle Details */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                            Vehicle
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            {booking.vehicleColor || ""}{" "}
                            {booking.vehicleMake || "N/A"}{" "}
                            {booking.vehicleModel || ""}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                            License Plate
                          </p>
                          <p className="text-sm font-semibold text-slate-700 tracking-wider">
                            {booking.licensePlate || "N/A"}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                            Driver Phone
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            {booking.driverPhone || "Not provided"}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                            Driver Email
                          </p>
                          <p className="text-sm font-semibold text-blue-700 truncate">
                            {booking.driverEmail || "Not provided"}
                          </p>
                        </div>
                      </div>

                      {/* Historical Route Map */}
                      <div className="mt-4">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-2">
                          Route Taken
                        </p>
                        <HistoricalMapView
                          routeGeometry={booking.routeGeometry}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Floating Chat Widget */}
      {activeRideId && (
        <div className="fixed bottom-10 right-10 z-[2000] flex flex-col items-end">
          {isChatOpen ? (
            <div className="bg-white w-80 h-[28rem] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4">
                <div
                  className="bg-indigo-600 text-white p-4 font-bold flex justify-between items-center cursor-pointer shadow-sm"
                  onClick={() => setIsChatOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💬</span>
                    <span>Ride Chat</span>
                  </div>
                  <button className="hover:bg-indigo-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50">
                  {chatMessages.map((msg, i) => {
                    const isSelf = msg.senderName === "Student" || msg.senderName === "Driver" || (profile && msg.senderName === profile.name);
                    return (
                      <div
                        key={i}
                        className={`max-w-[85%] p-3 text-sm shadow-sm ${isSelf ? "bg-indigo-600 text-white self-end rounded-t-2xl rounded-l-2xl rounded-br-none" : "bg-gray-100 text-slate-800 self-start rounded-t-2xl rounded-r-2xl rounded-bl-none"}`}
                      >
                        <div className={`font-bold text-[10px] mb-1 ${isSelf ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {msg.senderName}
                        </div>
                        <div className="leading-relaxed">{msg.text}</div>
                        <div className={`text-[9px] text-right mt-1 ${isSelf ? 'text-indigo-300' : 'text-slate-400'}`}>
                          {msg.timestamp}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth" }); }}></div>
                </div>
                <form
                  onSubmit={handleSendChatMessage}
                  className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-3 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="bg-indigo-600 disabled:bg-slate-300 text-white w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
                      <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : (
            <button
              onClick={() => setIsChatOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-14 h-14 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center justify-center text-2xl relative transform transition-transform active:scale-95"
            >
              💬
              {chatMessages.length > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                  {chatMessages.length}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* GPS Debug Badge */}
      {currentGps && (
        <div className="fixed bottom-2 left-2 z-[2000] bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded shadow font-mono">
          Raw GPS: {currentGps.lat.toFixed(6)}, {currentGps.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
