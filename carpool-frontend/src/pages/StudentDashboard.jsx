import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { API_BASE_URL, WS_BASE_URL } from "../config/api";

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
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
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
      if (polyline) polyline.remove();
      if (histMapInstance.current) {
        if (histMapInstance.current) histMapInstance.current.remove();
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
      className="w-full h-[300px] rounded-lg border-2 border-slate-200 dark:border-slate-700 mt-3"
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
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
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
      if (polyline) polyline.remove();
      if (previewMapInstance.current) {
        if (previewMapInstance.current) previewMapInstance.current.remove();
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
      className="w-full h-[250px] rounded-lg border-2 border-slate-200 dark:border-slate-700 mt-3"
    ></div>
  );
};

const RideCardSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex justify-between items-center w-full animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      <div className="flex flex-col gap-2">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mt-1"></div>
      </div>
    </div>
    <div className="w-28 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
  </div>
);

const StudentDashboard = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const hasInitialZoom = useRef(false);

  const [rides, setRides] = useState([]);
  const [ridePage, setRidePage] = useState(1);
  const ridesPerPage = 3;

  const availableRides = rides;
  const totalRidePages = Math.ceil(availableRides.length / ridesPerPage) || 1;
  const currentRidePage = Math.min(ridePage, totalRidePages);
  const paginatedRides = availableRides.slice(
    (currentRidePage - 1) * ridesPerPage,
    currentRidePage * ridesPerPage,
  );

  const [myBookings, setMyBookings] = useState([]);
  const activeBooking = myBookings.find((b) =>
    ["PENDING", "ACCEPTED", "DRIVER_ARRIVED", "IN_TRANSIT"].includes(
      b.status?.toUpperCase(),
    ),
  );
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
  const [activeChatTab, setActiveChatTab] = useState("RIDE"); // 'RIDE' | 'GLOBAL'
  const [chatMessages, setChatMessages] = useState([]);
  const [globalMessages, setGlobalMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const wsRef = useRef(null);
  const globalWsRef = useRef(null);
  const watchIdRef = useRef(null);

  // Global Chat WS & Hydration for Student Dashboard
  useEffect(() => {
    if (isChatOpen && activeChatTab === "GLOBAL") {
      fetch(`${API_BASE_URL}/api/public-chat/history`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const hydrated = data.map((msg) => ({
              senderName: msg.sender_name || msg.senderName || "Anonymous",
              text: msg.message || msg.text || "",
              timestamp: msg.timestamp,
            }));
            setGlobalMessages(hydrated);
          }
        })
        .catch((err) => console.error("Error loading chat history:", err));

      const wsUrl = WS_BASE_URL
        ? `${WS_BASE_URL}/ws/public-chat`
        : "ws://localhost:7070/ws/public-chat";
      globalWsRef.current = new WebSocket(wsUrl);
      globalWsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setGlobalMessages((prev) => [...prev, msg]);
        } catch (e) {}
      };
      globalWsRef.current.onclose = () => {
        globalWsRef.current = null;
      };
    }

    return () => {
      if (globalWsRef.current) {
        globalWsRef.current.onclose = null;
        globalWsRef.current.close();
        globalWsRef.current = null;
      }
    };
  }, [isChatOpen, activeChatTab]);

  const [currentGps, setCurrentGps] = useState(null);
  const routePolylineRef = useRef(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [expandedBookingId, setExpandedBookingId] = useState(null);
  const [expandedRouteRideId, setExpandedRouteRideId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-auth`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.name) setCurrentUser(data.name);
      })
      .catch(() => {});
  }, []);

  // Task 4: Request browser notification permissions on mount
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Task 4: Strict Dashboard Route Guard
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/user/active-status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.isDriver && data.driverRideId !== -1) {
          toast.error(
            "You cannot switch to Student mode during an active drive.",
          );
          navigate("/driver");
        }
      })
      .catch((err) => console.error("Error checking active status:", err));
  }, [navigate]);

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const activeStatusRef = useRef("PENDING");

  const fetchMyBookings = () => {
    fetch(`${API_BASE_URL}/api/bookings/my-rides`, {
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
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstance.current);
        setTimeout(() => mapInstance.current?.invalidateSize(), 150);
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

            fetch(`${API_BASE_URL}/api/location/update`, {
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
      fetch(`${API_BASE_URL}/api/rides/${activeRideId}/live`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.routeGeometry && data.routeGeometry.length >= 2) {
            if (mapInstance.current) {
              if (routePolylineRef.current) {
                if (routePolylineRef.current) routePolylineRef.current.remove();
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
        `${WS_BASE_URL}/ws/rides/${activeRideId}/live`,
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
                if (driverMarkerRef.current) driverMarkerRef.current.remove();
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
            toast.error("🚨 SOS EMERGENCY TRIGGERED FOR THIS RIDE!");
            return;
          } else if (data && data.type === "BOOKING_ACCEPTED") {
            toast.success("Driver accepted your booking!");
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification("CampusPool Update", {
                    body: "Your ride request was accepted.",
                    icon: "/favicon.ico",
                    vibrate: [200, 100, 200],
                  });
                });
              } else {
                new Notification("CampusPool Update", {
                  body: "Your ride request was accepted.",
                  icon: "/favicon.ico",
                });
              }
            }
            fetchMyBookings();
            return;
          } else if (data && data.type === "BOOKING_REJECTED") {
            toast.error(
              "Driver rejected your booking. Please find another ride.",
            );
            setMyBookings([]);
            setActiveRideId(null);
            setActiveTab("search");
            return;
          } else if (data && data.type === "DRIVER_CANCELLED") {
            toast("⚠️ The driver has canceled this ride.");
            setMyBookings([]);
            setActiveRideId(null);
            setActiveTab("search");
            return;
          } else if (data && data.type === "DRIVER_ARRIVED") {
            toast.success("Driver has arrived at your pickup location!");
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification("CampusPool Update", {
                    body: "Your driver has arrived!",
                    icon: "/favicon.ico",
                    vibrate: [200, 100, 200],
                  });
                });
              } else {
                new Notification("CampusPool Update", {
                  body: "Your driver has arrived!",
                  icon: "/favicon.ico",
                });
              }
            }
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
      fetch(`${API_BASE_URL}/api/rides/${activeRideId}/chat`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setChatMessages(data))
        .catch((err) => console.error(err));
    }

    return () => {
      // Constraint 3: Prevent polyline memory leaks
      if (routePolylineRef.current) {
        if (routePolylineRef.current) routePolylineRef.current.remove();
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
        if (mapInstance.current) mapInstance.current.remove();
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

          fetch(`${API_BASE_URL}/api/rides/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(studentLocation),
          })
            .then((res) => res.json())
            .then((data) => {
              setIsSearching(false);
              setRides(data);
              setRidePage(1);
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
    fetch(`${API_BASE_URL}/api/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // FIXED: Must be outside headers
      body: JSON.stringify({ rideId: rideId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          toast.success(data.message);
          fetchMyBookings();
        } else {
          toast.error(data.error);
        }
      });
  };

  const handleCancelBooking = () => {
    fetch(`${API_BASE_URL}/api/bookings/cancel`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          toast.success(data.message);
          setMyBookings([]);
          setActiveRideId(null);
          setActiveTab("search");
        } else toast.error(data.error);
      });
  };

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (activeChatTab === "GLOBAL") {
      if (
        !globalWsRef.current ||
        globalWsRef.current.readyState !== WebSocket.OPEN
      ) {
        toast.error("Global chat is not connected.");
        return;
      }
      const payload = {
        senderName: currentUser || "User",
        text: chatInput.trim(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      globalWsRef.current.send(JSON.stringify(payload));
      setChatInput("");
    } else {
      if (!wsRef.current || !activeRideId) return;

      const msg = {
        type: "CHAT_MESSAGE",
        senderId: -1,
        senderName: currentUser || "",
        targetUserId: driverId,
        text: chatInput.trim(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      wsRef.current.send(JSON.stringify(msg));
      setChatInput("");
    }
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
      fetch(`${API_BASE_URL}/api/rides/${rideIdToUse}/sos`, {
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
    <>
      <div
        className={`mx-auto p-4 lg:p-8 flex flex-col gap-6 w-full items-start ${
          activeBooking
            ? "max-w-[1400px] lg:grid lg:grid-cols-[1fr_1fr]"
            : "max-w-4xl"
        }`}
      >
        {/* Item 1: Tabs & Active Ride (order-1 on mobile) */}
        <div className="w-full flex flex-col gap-6 order-1 lg:order-1 lg:col-start-1 lg:row-start-1">
          <div className="flex gap-4 w-full">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 py-3 font-bold rounded-lg transition-colors shadow ${activeTab === "search" ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
            >
              Find a Ride
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-3 font-bold rounded-lg transition-colors shadow ${activeTab === "history" ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
            >
              Previous Bookings
            </button>
          </div>

          {/* Pinned Active Booking Card */}
          {activeBooking && (
            <div className="w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-l-8 border-teal-600 rounded-[2rem] shadow-xl shadow-teal-700/10 p-5 border border-white/40 dark:border-slate-700"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">
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
                                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
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
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                      Ride #{activeBooking.rideId}
                    </span>
                  </div>
                  <button
                    onClick={handleCancelBooking}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-5 rounded-lg shadow text-sm transition active:scale-95"
                  >
                    Cancel Booking
                  </button>
                </div>

                <details className="mt-3 group cursor-pointer">
                  <summary className="text-xs font-bold text-slate-500 dark:text-slate-400 select-none">
                    View Vehicle Details ▾
                  </summary>
                  <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                      🚗 {activeBooking.vehicleColor || ""}{" "}
                      {activeBooking.vehicleMake || "Vehicle"}{" "}
                      {activeBooking.vehicleModel || ""} (
                      {activeBooking.licensePlate || "N/A"})
                    </span>
                    {activeBooking.driverPhone && (
                      <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        📞 {activeBooking.driverPhone}
                      </span>
                    )}
                    {activeBooking.driverEmail && (
                      <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        ✉️ {activeBooking.driverEmail}
                      </span>
                    )}
                  </div>
                </details>
              </motion.div>
            </div>
          )}
        </div>

        {/* Item 3: Find a Ride to Campus & History (order-3 on mobile) */}
        <div className="w-full flex flex-col gap-6 order-3 lg:order-1 lg:col-start-1 lg:row-start-2">
          {/* Find a Ride Tab */}
          <div
            style={{ display: activeTab === "search" ? "flex" : "none" }}
            className="w-full flex-col gap-6"
          >
            {/* Scan My Area Hero Card */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg w-full border border-slate-200 dark:border-slate-700 text-center mb-8">
              <h2 className="text-3xl font-extrabold text-teal-900 dark:text-teal-400 mb-4">
                Find a Ride to Campus
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium">
                {searchStatus}
              </p>

              <button
                onClick={handleSearchRides}
                disabled={isSearching}
                className={`px-8 py-4 rounded-xl font-extrabold text-white transform transition-transform active:scale-95 flex items-center justify-center gap-3 ${
                  isSearching
                    ? "bg-indigo-400 cursor-not-allowed shadow-none"
                    : "bg-teal-600 hover:bg-teal-700 hover:shadow-lg shadow-md"
                }`}
              >
                {isSearching ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Scanning Route Data...
                  </>
                ) : (
                  "Scan My Area for Rides"
                )}
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
                paginatedRides.map((ride) => {
                  const hasActiveBooking = Boolean(activeBooking);
                  return (
                    <div
                      key={ride.rideId}
                      className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      <div className="p-5 hover:shadow-lg transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-inner">
                              {ride.driverName
                                ? ride.driverName.charAt(0)
                                : "D"}
                            </div>
                            <div>
                              <h4 className="font-bold text-lg text-slate-800 dark:text-white">
                                {ride.driverName || "Driver"}
                              </h4>
                              <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                Fare:{" "}
                                {ride.isFreeRide || ride.costPerSeat === 0
                                  ? "🌱 Free Ride"
                                  : `₹${ride.costPerSeat}/seat`}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {hasActiveBooking ? (
                              <div
                                className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold py-2 px-5 rounded-lg text-sm cursor-not-allowed"
                                title="Cancel active booking to book another ride"
                              >
                                Booking Active
                              </div>
                            ) : (
                              <button
                                onClick={() => handleBookSeat(ride.rideId)}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition-all active:scale-95 text-sm"
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
                              className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 text-xs font-bold underline"
                            >
                              {expandedRouteRideId === ride.rideId
                                ? "Hide Route"
                                : "View Route"}
                            </button>
                          </div>
                        </div>

                        <details className="mt-3 group cursor-pointer">
                          <summary className="text-xs font-bold text-slate-500 dark:text-slate-400 select-none">
                            View Ride Details ▾
                          </summary>
                          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                              🚗 {ride.carColor || ""}{" "}
                              {ride.vehicleMake || "Vehicle"}{" "}
                              {ride.vehicleModel || ""} (
                              {ride.licensePlate || "N/A"})
                            </span>
                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                              💺 {ride.availableSeats ?? ride.seats ?? 1} Seats
                              Left
                            </span>
                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                              📍 {ride.distanceKm || 0} km
                            </span>
                          </div>
                        </details>
                      </div>
                      {expandedRouteRideId === ride.rideId && (
                        <div className="border-t border-slate-100 dark:border-slate-700 px-6 pb-5">
                          <RoutePreviewMap routeGeometry={ride.routeGeometry} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {!isSearching && availableRides.length > ridesPerPage && (
                <div className="flex justify-between items-center mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setRidePage((p) => Math.max(1, p - 1))}
                    disabled={currentRidePage === 1}
                    className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Page {currentRidePage} of {totalRidePages}
                  </span>
                  <button
                    onClick={() =>
                      setRidePage((p) => Math.min(totalRidePages, p + 1))
                    }
                    disabled={currentRidePage >= totalRidePages}
                    className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                  >
                    Next
                  </button>
                </div>
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
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No previous rides to show.
                  </div>
                );
              }
              return (
                <div className="flex flex-col gap-3">
                  {pastBookings.map((booking) => (
                    <div
                      key={booking.bookingId}
                      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
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
                        className="w-full p-5 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-lg font-bold text-slate-700 dark:text-white">
                              {booking.driverName}
                            </h4>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                                booking.status === "COMPLETED"
                                  ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                                  : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {booking.status === "COMPLETED" ? "🏁 " : "✕ "}
                              {booking.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 dark:text-slate-400">
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
                        <div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5">
                          {/* Vehicle Details */}
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                Vehicle
                              </p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {booking.vehicleColor || ""}{" "}
                                {booking.vehicleMake || "N/A"}{" "}
                                {booking.vehicleModel || ""}
                              </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                License Plate
                              </p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wider">
                                {booking.licensePlate || "N/A"}
                              </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                Driver Phone
                              </p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {booking.driverPhone || "Not provided"}
                              </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                Driver Email
                              </p>
                              <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 truncate">
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
        </div>

        {/* Item 2: Map Container (rendered only when active booking exists) */}
        {activeBooking && (
          <div className="w-full order-2 lg:order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24">
            <div className="bg-white dark:bg-slate-800 p-0 lg:p-6 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-700 overflow-hidden w-full flex flex-col">
              <div className="flex justify-between items-center p-3 lg:p-0 mb-0 lg:mb-3">
                <h3 className="hidden lg:block text-md font-bold text-teal-900 dark:text-teal-300">
                  Live Tracking
                </h3>
                <div className="flex items-center gap-2">
                  {liveRideStatus === "DRIVER_ARRIVED" && (
                    <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-500 font-bold px-3 py-1 rounded text-xs">
                      📍 Driver Arrived
                    </div>
                  )}
                  {liveRideStatus === "IN_TRANSIT" && (
                    <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-500 font-bold px-3 py-1 rounded flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>{" "}
                      In Transit
                    </div>
                  )}
                  {etaMinutes !== null && liveRideStatus !== "COMPLETED" && (
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 font-bold px-3 py-1 rounded text-xs flex items-center gap-1 animate-pulse">
                      ⏱️ ~{etaMinutes} mins
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full h-[400px] lg:h-[500px] relative z-0">
                <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleRefocusMap}
                    className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded shadow font-bold text-teal-900 dark:text-teal-200 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-xs active:scale-95"
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
                  className="absolute inset-0 w-full h-full z-0"
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Chat Widget */}
      {activeRideId && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[2000] flex flex-col items-end">
          {isChatOpen ? (
            <div className="bg-white dark:bg-slate-800 w-[calc(100vw-2rem)] sm:w-[400px] max-w-full h-[30rem] max-h-[85vh] shadow-2xl shadow-teal-900/10 rounded-[1.5rem] overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col mb-4">
              <div
                className="bg-teal-600 text-white p-4 font-bold flex justify-between items-center cursor-pointer shadow-sm"
                onClick={() => setIsChatOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <span>
                    {activeChatTab === "GLOBAL"
                      ? "Campus Global Chat"
                      : "Ride Chat"}
                  </span>
                </div>
                <button className="hover:bg-teal-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                  ✕
                </button>
              </div>

              {/* Dual Tab Switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 border-b border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveChatTab("RIDE")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    activeChatTab === "RIDE"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-teal-700 dark:text-teal-300"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  Ride Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChatTab("GLOBAL")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    activeChatTab === "GLOBAL"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-teal-700 dark:text-teal-300"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  Campus Global
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/80">
                {(activeChatTab === "GLOBAL"
                  ? globalMessages
                  : chatMessages
                ).map((msg, i) => {
                  const isSelf = currentUser
                    ? msg.senderName === currentUser
                    : false;
                  return (
                    <div
                      key={i}
                      className={`max-w-[85%] p-3 text-sm shadow-sm ${isSelf ? "bg-teal-600 text-white self-end rounded-t-2xl rounded-l-2xl rounded-br-none shadow-sm shadow-teal-700/20" : "bg-gray-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 self-start rounded-t-2xl rounded-r-2xl rounded-bl-none"}`}
                    >
                      <div
                        className={`font-bold text-[10px] mb-1 ${isSelf ? "text-teal-200" : "text-slate-500 dark:text-slate-400"}`}
                      >
                        <span className="font-bold text-xs">
                          {msg.senderName}
                        </span>
                      </div>
                      <div className="leading-relaxed">{msg.text}</div>
                      <div
                        className={`text-[9px] text-right mt-1 ${isSelf ? "text-teal-300" : "text-slate-400 dark:text-slate-400"}`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  );
                })}
                <div
                  ref={(el) => {
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                ></div>
              </div>
              <form
                onSubmit={handleSendChatMessage}
                className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 items-center"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-transparent dark:border-slate-600"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 ml-1"
                  >
                    <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                  </svg>
                </button>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setIsChatOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white w-14 h-14 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center justify-center text-2xl relative transform transition-transform active:scale-95"
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
    </>
  );
};

export default StudentDashboard;
