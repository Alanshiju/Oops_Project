import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import L from "leaflet";
import "leaflet-routing-machine";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { API_BASE_URL, WS_BASE_URL } from "../config/api";
import { useSettings } from "../context/SettingsContext";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Patch LRM to prevent crash when _map is null during async route callbacks
if (L.Routing && L.Routing.Line) {
  const origClearLines = L.Routing.Line.prototype._clearLines;
  L.Routing.Line.prototype._clearLines = function () {
    if (!this._map) return;
    origClearLines.call(this);
  };
}

const pulsingDot = L.divIcon({
  className: "custom-div-icon",
  html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const carIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div class="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white shadow-lg"><span class="text-white text-xs">🚗</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const passengerIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg"><span class="text-white text-xs">🧍</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const DriverDashboard = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-auth`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.name) setCurrentUser(data.name);
      })
      .catch(() => {});
  }, []);

  // Task 4: Strict Dashboard Route Guard
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/user/active-status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.isPassenger) {
          toast.error("Cannot access Driver dashboard with an active booking.");
          navigate("/student");
        }
      })
      .catch((err) => console.error("Error checking active status:", err));
  }, [navigate]);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routingControlRef = useRef(null);
  const passengerMarkersRef = useRef([]);
  const driverSelfMarkerRef = useRef(null);

  const [routeGeometry, setRouteGeometry] = useState([]);
  const [seats, setSeats] = useState(3);
  const [currentRideId, setCurrentRideId] = useState(null);

  const [distanceKm, setDistanceKm] = useState(0);
  const [isFreeRide, setIsFreeRide] = useState(false);
  const maxFare = Math.floor((distanceKm * 5) / (seats || 1) / 2);
  const [customFare, setCustomFare] = useState(maxFare);

  useEffect(() => {
    setCustomFare(maxFare);
  }, [maxFare]);

  const [rideStatus, setRideStatus] = useState("PENDING");
  const rideStatusRef = useRef("PENDING");

  useEffect(() => {
    rideStatusRef.current = rideStatus;
  }, [rideStatus]);

  // Chat & SOS States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatTab, setActiveChatTab] = useState("RIDE"); // 'RIDE' | 'GLOBAL'
  const [chatMessages, setChatMessages] = useState([]);
  const [globalMessages, setGlobalMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatPassenger, setSelectedChatPassenger] = useState("");
  const wsRef = useRef(null);
  const globalWsRef = useRef(null);
  const watchIdRef = useRef(null);

  // Global Chat WS & Hydration for Driver Dashboard
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

  const [vehicle, setVehicle] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    make: "",
    model: "",
    licensePlate: "",
    color: "",
  });

  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState("");
  const [bookings, setBookings] = useState([]);

  // Flags & Refs for auto-loading and hydration
  const [isAutoLoadingRoute, setIsAutoLoadingRoute] = useState(false);
  const isAutoLoadingRouteRef = useRef(false);
  const pendingActiveRouteRef = useRef(null);
  const staticPolylineRef = useRef(null);

  const [collegeLocation, setCollegeLocation] = useState(
    L.latLng(10.728, 76.2792),
  );
  const [isDestinationLoaded, setIsDestinationLoaded] = useState(false);
  const [estimatedDurationMins, setEstimatedDurationMins] = useState(0);

  // Map global CMS settings to college location
  useEffect(() => {
    if (settings && settings.location) {
      setCollegeLocation(
        L.latLng(settings.location.lat, settings.location.lng),
      );
      setIsDestinationLoaded(true);
    }
  }, [settings]);

  const setAutoLoading = (val) => {
    isAutoLoadingRouteRef.current = val;
    setIsAutoLoadingRoute(val);
  };

  const fetchFavorites = (isInitial = false) => {
    fetch(`${API_BASE_URL}/api/user/route/favorite`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && Array.isArray(data)) {
          setFavoriteRoutes(data);
          // Only auto-load favorite route if not already in an active ride
          if (
            isInitial &&
            data.length > 0 &&
            routingControlRef.current &&
            !pendingActiveRouteRef.current
          ) {
            const lastRoute = data[data.length - 1];
            if (lastRoute.waypoints && lastRoute.waypoints.length > 0) {
              const waypoints = lastRoute.waypoints.map((coord) =>
                L.latLng(coord.lat, coord.lng),
              );
              setAutoLoading(true);
              routingControlRef.current.setWaypoints(waypoints);
              mapInstance.current.fitBounds(L.latLngBounds(waypoints));
              setTimeout(() => setAutoLoading(false), 1000);
            }
          }
        }
      })
      .catch((err) => console.error(err));
  };

  // Request browser notification permissions on mount
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Task 4: Complete State Hydration on Refresh & Fix Dummy Ride ID bug
  useEffect(() => {
    // Check if user already has an active ride
    fetch(`${API_BASE_URL}/api/user/active-status`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (
          data.isDriver &&
          data.driverRideId &&
          data.driverRideId !== -1 &&
          data.driverRideId !== 999
        ) {
          setCurrentRideId(data.driverRideId);
          if (data.rideStatus) {
            setRideStatus(data.rideStatus);
          }
          if (data.distance_km !== undefined && data.distance_km !== null) {
            setDistanceKm(data.distance_km);
          }
          if (data.seats !== undefined && data.seats !== null) {
            setSeats(data.seats);
          }

          if (data.route_geometry) {
            const geom =
              typeof data.route_geometry === "string"
                ? JSON.parse(data.route_geometry)
                : data.route_geometry;
            if (Array.isArray(geom) && geom.length >= 2) {
              setRouteGeometry(geom);
              pendingActiveRouteRef.current = geom;
              if (routingControlRef.current) {
                const waypoints = [
                  L.latLng(geom[0].lat, geom[0].lng),
                  L.latLng(
                    geom[geom.length - 1].lat,
                    geom[geom.length - 1].lng,
                  ),
                ];
                setAutoLoading(true);
                routingControlRef.current.setWaypoints(waypoints);
                if (mapInstance.current) {
                  mapInstance.current.fitBounds(L.latLngBounds(waypoints));
                }
                setTimeout(() => setAutoLoading(false), 1000);
              }
            }
          }
        }
      });

    // Fetch Vehicle Profile
    fetch(`${API_BASE_URL}/api/profile/vehicle`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data) {
          setVehicle(data);
          setVehicleForm(data);
        }
      });
  }, []);

  // Map Initialization (Constraint 4: Blocked until isDestinationLoaded is true)
  useEffect(() => {
    if (!isDestinationLoaded) return;
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView(
        [10.5276, 76.2144],
        11,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapInstance.current);

      routingControlRef.current = L.Routing.control({
        waypoints: [],
        routeWhileDragging: true,
        addWaypoints: true,
        showAlternatives: false,
        fitSelectedRoutes: true,
        show: false,
        lineOptions: {
          styles: [{ color: "#111827", weight: 6, opacity: 0.9 }],
        },
        createMarker: function (i, wp, nWps) {
          // Task 4: Forcefully lock the destination marker from being dragged
          const isDestination = i === nWps - 1;
          return L.marker(wp.latLng, {
            icon: i === 0 ? carIcon : pulsingDot,
            draggable: !isDestination,
          });
        },
      }).addTo(mapInstance.current);

      routingControlRef.current.on("routesfound", (e) => {
        setRouteGeometry(e.routes[0].coordinates);
        const distMeters = e.routes[0].summary.totalDistance;
        setDistanceKm(parseFloat((distMeters / 1000).toFixed(1)));
        // Task 3: Capture estimated duration from LRM
        const durationMins = Math.round(
          (e.routes[0].summary.totalTime || 0) / 60,
        );
        setEstimatedDurationMins(durationMins);
      });

      // Task 3 & 4: Bypass 3-waypoint restriction during auto-loading & lock destination waypoint
      routingControlRef.current.on("waypointschanged", (e) => {
        if (isAutoLoadingRouteRef.current) {
          return;
        }
        const waypoints = e.waypoints.filter((wp) => wp.latLng !== null);
        if (waypoints.length > 3) {
          toast(
            "Route too complex! Please select only ONE custom turning point.",
          );
          routingControlRef.current.setWaypoints([
            waypoints[0].latLng,
            collegeLocation,
          ]);
          return;
        }
        // Task 4: Forcefully lock the last waypoint to the fetched collegeLocation
        if (waypoints.length > 0) {
          const lastWp = waypoints[waypoints.length - 1];
          if (
            lastWp.latLng &&
            (Math.abs(lastWp.latLng.lat - collegeLocation.lat) > 0.0001 ||
              Math.abs(lastWp.latLng.lng - collegeLocation.lng) > 0.0001)
          ) {
            waypoints[waypoints.length - 1] =
              L.Routing.waypoint(collegeLocation);
            routingControlRef.current.setWaypoints(waypoints);
          }
        }
      });

      routingControlRef.current.on("routingerror", () => {
        toast(
          "Invalid route! Cannot drive through this area. Reverting to main road.",
        );
        const waypoints = routingControlRef.current.getWaypoints();
        routingControlRef.current.setWaypoints([
          waypoints[0].latLng,
          collegeLocation,
        ]);
      });

      // If active route is already retrieved, hydrate it; otherwise auto-load favorite route
      if (
        pendingActiveRouteRef.current &&
        pendingActiveRouteRef.current.length >= 2
      ) {
        const geom = pendingActiveRouteRef.current;
        const waypoints = [
          L.latLng(geom[0].lat, geom[0].lng),
          L.latLng(geom[geom.length - 1].lat, geom[geom.length - 1].lng),
        ];
        setAutoLoading(true);
        routingControlRef.current.setWaypoints(waypoints);
        mapInstance.current.fitBounds(L.latLngBounds(waypoints));
        setTimeout(() => setAutoLoading(false), 1000);
      } else {
        fetchFavorites(true);
      }
    }

    return () => {
      try {
        const map = mapInstance.current || mapRef.current;
        if (routingControlRef.current && map) {
          // Disconnect OSRM from the map before removing it to prevent asynchronous layer crashes
          routingControlRef.current.setWaypoints([]);
          if (typeof map.removeControl === "function") {
            map.removeControl(routingControlRef.current);
          }
          routingControlRef.current = null;
        }
      } catch (e) {
        console.warn("Safely caught OSRM cleanup error:", e);
      }

      // Constraint 3: Prevent polyline memory leaks
      if (staticPolylineRef.current) {
        try {
          staticPolylineRef.current.remove();
        } catch (e) {}
        staticPolylineRef.current = null;
      }
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (e) {}
        mapInstance.current = null;
      }
    };
  }, [isDestinationLoaded]);

  // Task 1: Bulletproof Route Lock (Polyline Swap) & Constraint 3: Prevent Polyline Memory Leaks
  useEffect(() => {
    const isLocked =
      rideStatus !== "PENDING" ||
      (currentRideId !== null && currentRideId !== -1 && currentRideId !== 999);

    if (isLocked && mapInstance.current) {
      // Completely remove LRM routing control to eliminate draggable waypoints UI
      if (routingControlRef.current) {
        try {
          if (mapInstance.current && routingControlRef.current)
            mapInstance.current.removeControl(routingControlRef.current);
        } catch (e) {
          console.error("Error removing routing control:", e);
        }
        routingControlRef.current = null;
      }

      // Draw static polyline if routeGeometry exists
      if (routeGeometry && routeGeometry.length >= 2) {
        if (staticPolylineRef.current) {
          staticPolylineRef.current.remove();
          staticPolylineRef.current = null;
        }
        const latlngs = routeGeometry.map((c) => [c.lat, c.lng]);
        staticPolylineRef.current = L.polyline(latlngs, {
          color: "#111827",
          weight: 6,
          opacity: 0.9,
        }).addTo(mapInstance.current);
        mapInstance.current.fitBounds(staticPolylineRef.current.getBounds(), {
          padding: [40, 40],
        });
      }
    }

    return () => {
      // Constraint 3: Proactively remove polyline ref on unmount or re-render
      if (staticPolylineRef.current) {
        staticPolylineRef.current.remove();
        staticPolylineRef.current = null;
      }
    };
  }, [rideStatus, currentRideId, routeGeometry]);

  useEffect(() => {
    let liveDataInterval = null;

    if (currentRideId && currentRideId !== -1 && currentRideId !== 999) {
      // Initialize native WebSocket connection
      wsRef.current = new WebSocket(
        `${WS_BASE_URL}/ws/rides/${currentRideId}/live`,
      );

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "CHAT_MESSAGE") {
            setChatMessages((prev) => [...prev, data]);
          } else if (data.type === "SOS_ALERT") {
            toast.error("SOS EMERGENCY TRIGGERED FOR THIS RIDE!");
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification("CampusPool Driver", {
                    body: "SOS Emergency Triggered!",
                    icon: "../../public/favicon.ico",
                    vibrate: [200, 100, 200],
                  });
                });
              } else {
                new Notification("CampusPool Driver", {
                  body: "SOS Emergency Triggered!",
                  icon: "/favicon.ico",
                });
              }
            }
          } else if (data.type === "NEW_BOOKING_REQUEST") {
            toast("🔔 New booking request from " + data.name);
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification("CampusPool Driver", {
                    body: `New booking request from ${data.name || "a passenger"}`,
                    icon: "/favicon.ico",
                    vibrate: [200, 100, 200],
                  });
                });
              } else {
                new Notification("CampusPool Driver", {
                  body: `New booking request from ${data.name || "a passenger"}`,
                  icon: "/favicon.ico",
                });
              }
            }
            fetchBookings(); // Fetch new bookings immediately
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };

      const fetchBookings = () => {
        fetch(`${API_BASE_URL}/api/rides/${currentRideId}/bookings`, {
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => setBookings(data || []))
          .catch(console.error);
      };
      fetchBookings();

      // Fetch chat history
      fetch(`${API_BASE_URL}/api/rides/${currentRideId}/chat`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setChatMessages(data))
        .catch((err) => console.error(err));

      // 1. Efficient hardware-optimized GPS telemetry
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const newPos = [
              position.coords.latitude,
              position.coords.longitude,
            ];

            // Task 5: Driver Self-Marker
            if (!driverSelfMarkerRef.current) {
              if (mapInstance.current) {
                driverSelfMarkerRef.current = L.marker(newPos, {
                  icon: carIcon,
                }).addTo(mapInstance.current);
              }
            } else {
              driverSelfMarkerRef.current.setLatLng(newPos);
            }

            fetch(`${API_BASE_URL}/api/location/update`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                rideId: currentRideId,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }),
            }).catch((err) =>
              console.error("Error pushing driver location:", err),
            );
          },
          (error) => {
            console.warn("Geolocation warning in driver push:", error.message);
          },
          { enableHighAccuracy: true, maximumAge: 1000 },
        );
      }

      // 2. Poll live passengers and seat updates every 3s
      liveDataInterval = setInterval(() => {
        fetch(`${API_BASE_URL}/api/rides/${currentRideId}/live`, {
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.availableSeats !== undefined) {
              setSeats((prevSeats) => {
                if (data.availableSeats < prevSeats) {
                  return data.availableSeats; // Removed alert here, since we now have NEW_BOOKING_REQUEST alert
                }
                return prevSeats;
              });
            }

            // Plot passengers (Task 3: Only when IN_TRANSIT)
            if (rideStatusRef.current === "IN_TRANSIT") {
              if (mapInstance.current && data.passengers) {
                passengerMarkersRef.current.forEach((m) => {
                  if (mapInstance.current && m)
                    mapInstance.current.removeLayer(m);
                });
                passengerMarkersRef.current = [];
                data.passengers.forEach((p) => {
                  if (p && p.lat && p.lng) {
                    const m = L.marker([p.lat, p.lng], {
                      icon: passengerIcon,
                    }).addTo(mapInstance.current);
                    if (p.name)
                      m.bindTooltip(p.name, {
                        permanent: true,
                        direction: "top",
                      });
                    passengerMarkersRef.current.push(m);
                  }
                });
              }
            } else {
              if (passengerMarkersRef.current) {
                passengerMarkersRef.current.forEach((m) => {
                  if (mapInstance.current) {
                    if (mapInstance.current && m)
                      if (mapInstance.current && m)
                        mapInstance.current.removeLayer(m);
                  }
                });
                passengerMarkersRef.current = [];
              }
            }
          })
          .catch((err) => console.error("Error fetching live ride data:", err));
      }, 3000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (liveDataInterval) {
        clearInterval(liveDataInterval);
      }
    };
  }, [currentRideId]);

  const handleSaveVehicle = (e) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/api/profile/vehicle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(vehicleForm),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          toast.success(data.message);
          setVehicle(vehicleForm);
          setShowVehicleModal(false);
        } else {
          toast.error(data.error);
        }
      });
  };

  const handlePublishRide = () => {
    if (!vehicle || !vehicle.make || !vehicle.model || !vehicle.licensePlate) {
      toast(
        "⚠️ You must complete your Vehicle Profile before offering a ride.",
      );
      setShowVehicleModal(true);
      return;
    }
    if (routeGeometry.length === 0) {
      toast("Please wait for the route to calculate before publishing.");
      return;
    }

    fetch(`${API_BASE_URL}/api/rides/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        seats: seats,
        distanceKm: distanceKm,
        customFare: isFreeRide ? 0 : customFare,
        isFreeRide: isFreeRide,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.rideId) {
          const newRideId = data.rideId;
          // Immediately save route
          fetch(`${API_BASE_URL}/api/route/save/${newRideId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              routeGeometry: routeGeometry,
              distanceKm: distanceKm,
              isFreeRide: isFreeRide,
              estimatedDurationMins: estimatedDurationMins,
              costPerSeat: isFreeRide ? 0 : customFare,
              customFare: isFreeRide ? 0 : customFare,
              fare: isFreeRide ? 0 : customFare,
            }),
          })
            .then((resRoute) => resRoute.json())
            .then((dataRoute) => {
              if (dataRoute.message) {
                setCurrentRideId(newRideId);
                setRideStatus("PENDING");
                toast.success(
                  "Ride Published and Route Saved! You are now live.",
                );
              } else {
                toast("❌ Failed to save route: " + dataRoute.error);
              }
            });
        } else {
          toast.error(data.error);
        }
      });
  };

  const handleUpdateStatus = (newStatus) => {
    fetch(`${API_BASE_URL}/api/rides/${currentRideId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setRideStatus(newStatus);
          if (newStatus === "COMPLETED") {
            toast(
              "✅ Ride Completed! Showing summary...\nDistance: " +
                distanceKm +
                "km\nEarnings: " +
                (isFreeRide ? "₹0" : `₹${customFare}/seat`),
            );
            setCurrentRideId(null);
            setRideStatus("PENDING");
            setRouteGeometry([]);
            setDistanceKm(0);
            pendingActiveRouteRef.current = null;
            ensureRoutingControl();
            if (favoriteRoutes && favoriteRoutes.length > 0) {
              const latestFav = favoriteRoutes[favoriteRoutes.length - 1];
              handleLoadFavorite(latestFav);
            } else if (routingControlRef.current) {
              const waypoints = routingControlRef.current.getWaypoints();
              if (waypoints && waypoints.length > 0 && waypoints[0].latLng) {
                routingControlRef.current.setWaypoints([
                  waypoints[0].latLng,
                  collegeLocation,
                ]);
              } else {
                routingControlRef.current.setWaypoints([
                  L.latLng(10.5276, 76.2144),
                  collegeLocation,
                ]);
              }
            }
          }
        } else {
          toast.error(data.error);
        }
      });
  };

  const handleRefocusMap = () => {
    if (mapInstance.current) {
      const markers = [];
      if (driverSelfMarkerRef.current)
        markers.push(driverSelfMarkerRef.current);
      if (passengerMarkersRef.current) {
        passengerMarkersRef.current.forEach((m) => markers.push(m));
      }
      if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        mapInstance.current.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }
  };

  const ensureRoutingControl = () => {
    if (staticPolylineRef.current) {
      staticPolylineRef.current.remove();
      staticPolylineRef.current = null;
    }

    if (!routingControlRef.current && mapInstance.current) {
      routingControlRef.current = L.Routing.control({
        waypoints: [],
        routeWhileDragging: true,
        addWaypoints: true,
        showAlternatives: false,
        fitSelectedRoutes: true,
        show: false,
        lineOptions: {
          styles: [{ color: "#111827", weight: 6, opacity: 0.9 }],
        },
        createMarker: function (i, wp, nWps) {
          const isDestination = i === nWps - 1;
          return L.marker(wp.latLng, {
            icon: i === 0 ? carIcon : pulsingDot,
            draggable: !isDestination,
          });
        },
      }).addTo(mapInstance.current);

      routingControlRef.current.on("routesfound", (e) => {
        setRouteGeometry(e.routes[0].coordinates);
        const distMeters = e.routes[0].summary.totalDistance;
        setDistanceKm(parseFloat((distMeters / 1000).toFixed(1)));
        const durationMins = Math.round(
          (e.routes[0].summary.totalTime || 0) / 60,
        );
        setEstimatedDurationMins(durationMins);
      });

      routingControlRef.current.on("waypointschanged", (e) => {
        if (isAutoLoadingRouteRef.current) return;
        const waypoints = e.waypoints.filter((wp) => wp.latLng !== null);
        if (waypoints.length > 3) {
          toast(
            "Route too complex! Please select only ONE custom turning point.",
          );
          routingControlRef.current.setWaypoints([
            waypoints[0].latLng,
            collegeLocation,
          ]);
          return;
        }
        if (waypoints.length > 0) {
          const lastWp = waypoints[waypoints.length - 1];
          if (
            lastWp.latLng &&
            (Math.abs(lastWp.latLng.lat - collegeLocation.lat) > 0.0001 ||
              Math.abs(lastWp.latLng.lng - collegeLocation.lng) > 0.0001)
          ) {
            waypoints[waypoints.length - 1] =
              L.Routing.waypoint(collegeLocation);
            routingControlRef.current.setWaypoints(waypoints);
          }
        }
      });

      routingControlRef.current.on("routingerror", () => {
        toast(
          "Invalid route! Cannot drive through this area. Reverting to main road.",
        );
        const waypoints = routingControlRef.current.getWaypoints();
        routingControlRef.current.setWaypoints([
          waypoints[0].latLng,
          collegeLocation,
        ]);
      });
    }
  };

  const handleDrawNew = () => {
    ensureRoutingControl();
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const liveStart = L.latLng(
            position.coords.latitude,
            position.coords.longitude,
          );
          if (routingControlRef.current) {
            routingControlRef.current.setWaypoints([
              liveStart,
              collegeLocation,
            ]);
          }
          if (mapInstance.current) {
            mapInstance.current.setView(liveStart, 12);
          }
        },
        (err) => console.error(err),
        { enableHighAccuracy: true },
      );
    } else {
      if (routingControlRef.current) {
        routingControlRef.current.setWaypoints([
          L.latLng(10.5276, 76.2144),
          collegeLocation,
        ]);
      }
    }
  };

  const handleLoadFavorite = (indexOrObj) => {
    if (indexOrObj === "") return;
    let data;
    if (typeof indexOrObj === "object" && indexOrObj.waypoints) {
      data = indexOrObj.waypoints;
    } else {
      if (!favoriteRoutes[indexOrObj]) return;
      data = favoriteRoutes[indexOrObj].waypoints;
    }

    if (data && data.length > 0 && routingControlRef.current) {
      const waypoints = data.map((coord) => L.latLng(coord.lat, coord.lng));
      setAutoLoading(true);
      routingControlRef.current.setWaypoints(waypoints);
      mapInstance.current.fitBounds(L.latLngBounds(waypoints));
      setTimeout(() => setAutoLoading(false), 1000);
    }
    setSelectedRouteIndex(""); // reset
  };

  const handleSaveFavorite = () => {
    if (!routingControlRef.current) return;
    const waypoints = routingControlRef.current
      .getWaypoints()
      .filter((wp) => wp.latLng)
      .map((wp) => ({ lat: wp.latLng.lat, lng: wp.latLng.lng }));
    if (waypoints.length < 2) {
      toast("Please draw a route first!");
      return;
    }

    const routeName = window.prompt(
      "Enter a name for this favorite route:",
      "My Route",
    );
    if (!routeName) return;

    fetch(`${API_BASE_URL}/api/user/route/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: routeName, waypoints }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          toast.success(data.message);
          fetchFavorites();
        } else toast.error(data.error);
      });
  };

  const handleUpdateStart = () => {
    if ("geolocation" in navigator && routingControlRef.current) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const waypoints = routingControlRef.current.getWaypoints();
        if (waypoints.length >= 2) {
          waypoints[0] = L.Routing.waypoint(
            L.latLng(pos.coords.latitude, pos.coords.longitude),
          );
          routingControlRef.current.setWaypoints(waypoints);
        }
      });
    }
  };

  const handleCancelRide = () => {
    fetch(`${API_BASE_URL}/api/rides/cancel`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          toast.success(data.message);
          setCurrentRideId(null);
          setRideStatus("PENDING");
          setRouteGeometry([]);
          pendingActiveRouteRef.current = null;
          ensureRoutingControl();
          if (favoriteRoutes && favoriteRoutes.length > 0) {
            const latestFav = favoriteRoutes[favoriteRoutes.length - 1];
            handleLoadFavorite(latestFav);
          } else if (routingControlRef.current) {
            const waypoints = routingControlRef.current.getWaypoints();
            if (waypoints && waypoints.length > 0 && waypoints[0].latLng) {
              routingControlRef.current.setWaypoints([
                waypoints[0].latLng,
                collegeLocation,
              ]);
            } else {
              routingControlRef.current.setWaypoints([
                L.latLng(10.5276, 76.2144),
                collegeLocation,
              ]);
            }
          }
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
      if (!wsRef.current || !currentRideId) return;

      const msg = {
        type: "CHAT_MESSAGE",
        senderId: -1,
        senderName: currentUser || "",
        targetUserId: selectedChatPassenger ? selectedChatPassenger : null,
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
    if (!currentRideId || !navigator.geolocation) return;
    if (
      !window.confirm(
        "🚨 Are you sure you want to trigger an SOS Emergency Alert? This will notify administration immediately.",
      )
    )
      return;

    navigator.geolocation.getCurrentPosition((pos) => {
      fetch(`${API_BASE_URL}/api/rides/${currentRideId}/sos`, {
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
          if (data.message) toast(data.message);
          else toast(data.error);
        });
    });
  };

  const handleBookingAction = (bookingId, action) => {
    fetch(`${API_BASE_URL}/api/bookings/${bookingId}/${action}`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          fetch(`${API_BASE_URL}/api/rides/${currentRideId}/bookings`, {
            credentials: "include",
          })
            .then((res) => res.json())
            .then((data) => setBookings(data || []));
        } else {
          toast.error(data.error);
        }
      });
  };

  return (
    <>
      <div className="max-w-[1400px] mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-[3fr_1fr] items-start gap-8">
        {/* Left Column: Header + Map + Map Controls */}
        <div className="flex flex-col gap-4 w-full h-full">
          <div className="flex justify-between items-end bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h1 className="text-2xl font-bold text-blue-900 dark:text-white">
              Driver: Plan Your Route
            </h1>
            <button
              onClick={() => setShowVehicleModal(true)}
              className="bg-indigo-100 dark:bg-slate-700 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-slate-600 font-bold py-2 px-4 rounded-lg transition-colors border border-indigo-200 dark:border-slate-600 shadow-sm text-sm"
            >
              {vehicle ? "Edit Vehicle Profile" : "Set Vehicle Profile"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <button
              onClick={handleDrawNew}
              className="bg-slate-800 dark:bg-slate-700 text-white font-bold py-1.5 px-3 rounded text-sm hover:bg-slate-700 dark:hover:bg-slate-600"
            >
              Draw New Route
            </button>

            <select
              className="border border-slate-200 dark:border-slate-600 rounded p-1.5 text-sm bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-white font-bold max-w-[200px]"
              value={selectedRouteIndex}
              onChange={(e) => {
                setSelectedRouteIndex(e.target.value);
                handleLoadFavorite(e.target.value);
              }}
            >
              <option value="" disabled>
                Select a saved route...
              </option>
              {favoriteRoutes.map((route, i) => (
                <option key={i} value={i}>
                  {route.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleUpdateStart}
              className="bg-green-600 text-white font-bold py-1.5 px-3 rounded text-sm hover:bg-green-700"
            >
              📍 Update Start
            </button>
            <button
              onClick={handleSaveFavorite}
              className="bg-yellow-500 text-white font-bold py-1.5 px-3 rounded text-sm hover:bg-yellow-600 ml-auto"
            >
              ⭐ Save Route
            </button>
          </div>

          <div className="relative w-full flex-grow z-0 min-h-[400px]">
            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRefocusMap}
                className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded shadow font-bold text-blue-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs active:scale-95"
              >
                Refocus Map
              </button>
            </div>
            <div className="w-full h-[50vh] lg:h-[750px] rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-black/40 border border-slate-200 dark:border-slate-700 z-0 relative bg-slate-100 dark:bg-slate-900/50">
              <div
                ref={mapRef}
                className="absolute inset-0 w-full h-full"
              ></div>
            </div>
          </div>
        </div>

        {/* Right Column: Scrollable Sidebar */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          {/* Step 1: Setup & Publish */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
            <h3 className="text-md font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
              Step 1: Setup & Publish
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Available Seats:
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-16 p-1 border border-slate-200 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="freeRide"
                checked={isFreeRide}
                onChange={(e) => setIsFreeRide(e.target.checked)}
              />
              <label
                htmlFor="freeRide"
                className="text-sm font-bold text-emerald-600 dark:text-emerald-400"
              >
                🌱 Free Ride (No Fee)
              </label>
            </div>
            {!isFreeRide && maxFare > 0 && (
              <div className="flex flex-col gap-1 mt-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Set Fare: ₹{customFare}
                </label>
                <input
                  type="range"
                  min="0"
                  max={maxFare}
                  value={customFare}
                  onChange={(e) => setCustomFare(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            )}
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Fare: {isFreeRide ? "₹0" : `₹${customFare} / seat`}
            </div>
            <button
              onClick={handlePublishRide}
              disabled={currentRideId !== null}
              className={`font-bold py-2 px-4 rounded-lg shadow-md text-sm w-full ${
                currentRideId
                  ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 text-white active:scale-95"
              }`}
            >
              {currentRideId
                ? `Ride #${currentRideId} Active`
                : "Publish & Start Ride"}
            </button>
            {currentRideId && (
              <button
                onClick={handleCancelRide}
                className="font-bold py-2 px-4 rounded-lg shadow-md text-sm w-full bg-red-500 hover:bg-red-600 text-white mt-1"
              >
                Cancel Ride
              </button>
            )}
          </div>

          {/* Step 2: Passenger Approvals */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
            <h3 className="text-md font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
              Step 2: Passengers
            </h3>
            {!currentRideId ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Publish ride to receive bookings.
              </p>
            ) : bookings.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No bookings yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {bookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2"
                  >
                    <div className="font-bold text-slate-800 dark:text-white">
                      {b.passengerName}{" "}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        ({b.status})
                      </span>
                    </div>

                    {b.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleBookingAction(b.bookingId, "accept")
                          }
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg transform transition-transform active:scale-95 shadow-sm hover:shadow-md"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            handleBookingAction(b.bookingId, "reject")
                          }
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transform transition-transform active:scale-95 shadow-sm hover:shadow-md"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {b.status === "ACCEPTED" && (
                      <button
                        onClick={() =>
                          handleBookingAction(b.bookingId, "arrived")
                        }
                        className="w-full bg-amber-500 text-white text-xs font-bold py-1 rounded"
                      >
                        📍 I've Arrived
                      </button>
                    )}
                    {b.status === "DRIVER_ARRIVED" && (
                      <div className="text-xs text-green-600 dark:text-green-400 font-bold text-center">
                        Passenger Notified
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Ride Status */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
            <h3 className="text-md font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
              Step 3: Ride Status
            </h3>
            {currentRideId ? (
              <div className="flex flex-col gap-2">
                {rideStatus === "PENDING" && (
                  <button
                    onClick={() => handleUpdateStatus("IN_TRANSIT")}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3.5 px-6 rounded-full hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-900/25"
                  >
                    🚗 Start Driving
                  </button>
                )}
                {rideStatus === "IN_TRANSIT" && (
                  <button
                    onClick={() => handleUpdateStatus("COMPLETED")}
                    className="w-full bg-teal-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded shadow"
                  >
                    🏁 Complete Ride
                  </button>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                  <button
                    onClick={handleSos}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow animate-pulse"
                  >
                    🚨 SOS Emergency
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a route to manage status.
              </p>
            )}
          </div>
        </div>

        {/* Modals & Chat */}
        {showVehicleModal && (
          <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                Vehicle Profile
              </h2>
              <form
                onSubmit={handleSaveVehicle}
                className="flex flex-col gap-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Make
                  </label>
                  <input
                    required
                    type="text"
                    value={vehicleForm.make}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, make: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Model
                  </label>
                  <input
                    required
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, model: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    License Plate
                  </label>
                  <input
                    required
                    type="text"
                    value={vehicleForm.licensePlate}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        licensePlate: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Color
                  </label>
                  <input
                    required
                    type="text"
                    value={vehicleForm.color}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, color: e.target.value })
                    }
                    className="w-full p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowVehicleModal(false)}
                    className="flex-1 py-2 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-md"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {currentRideId && (
          <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[2000] flex flex-col items-end">
            {isChatOpen ? (
              <div className="bg-white dark:bg-slate-800 w-[calc(100vw-2rem)] sm:w-[400px] max-w-full h-[30rem] max-h-[85vh] shadow-2xl shadow-teal-900/10 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 flex flex-col mb-4">
                <div
                  className="bg-teal-600 text-white p-4 font-bold flex justify-between items-center cursor-pointer shadow-md z-10 relative rounded-t-[1.5rem]"
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsChatOpen(false);
                    }}
                    className="hover:bg-teal-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Task 2: Passenger Selector directly below chat header with relative z-[9999] */}
                {activeChatTab === "RIDE" &&
                  bookings.filter((b) =>
                    ["ACCEPTED", "DRIVER_ARRIVED", "IN_TRANSIT"].includes(
                      b.bookingStatus,
                    ),
                  ).length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/80 p-2 border-b border-slate-200 dark:border-slate-700 relative z-[9999]">
                      <select
                        value={selectedChatPassenger}
                        onChange={(e) =>
                          setSelectedChatPassenger(e.target.value)
                        }
                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium cursor-pointer shadow-sm"
                      >
                        <option value="">Broadcast to all passengers</option>
                        {bookings
                          .filter((b) =>
                            [
                              "ACCEPTED",
                              "DRIVER_ARRIVED",
                              "IN_TRANSIT",
                            ].includes(b.bookingStatus),
                          )
                          .map((p) => (
                            <option key={p.passengerId} value={p.passengerId}>
                              Private: {p.passengerName}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                {/* Dual Tab Switcher */}
                <div className="flex bg-slate-100 dark:bg-slate-900/90 p-1 border-b border-slate-200 dark:border-slate-700">
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
                  className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 items-center rounded-b-[1.5rem]"
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
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-full p-4 shadow-2xl flex items-center justify-center animate-bounce relative"
              >
                💬 Chat
                {chatMessages.length > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {chatMessages.length}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DriverDashboard;
