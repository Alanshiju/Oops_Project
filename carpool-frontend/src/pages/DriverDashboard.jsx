import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import L from "leaflet";
import "leaflet-routing-machine";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routingControlRef = useRef(null);
  const passengerMarkersRef = useRef([]);

  const [routeGeometry, setRouteGeometry] = useState([]);
  const [seats, setSeats] = useState(3);
  const [currentRideId, setCurrentRideId] = useState(null);

  const [distanceKm, setDistanceKm] = useState(0);
  const [isFreeRide, setIsFreeRide] = useState(false);
  const [rideStatus, setRideStatus] = useState("PENDING");

  // Chat & SOS States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const wsRef = useRef(null);

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

  const collegeLocation = L.latLng(10.728, 76.2792);

  useEffect(() => {
    // Check if user already has an active ride
    fetch("http://localhost:7070/api/user/active-status", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.isDriver && data.driverRideId && data.driverRideId !== -1) {
          setCurrentRideId(data.driverRideId);
        } else if (data.isDriver) {
          setCurrentRideId(999);
        }
      });

    // Fetch Vehicle Profile
    fetch("http://localhost:7070/api/profile/vehicle", {
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

  useEffect(() => {
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView(
        [10.5276, 76.2144],
        11,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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
          return L.marker(wp.latLng, {
            icon: i === 0 ? carIcon : pulsingDot,
            draggable: true,
          });
        },
      }).addTo(mapInstance.current);

      routingControlRef.current.on("routesfound", (e) => {
        setRouteGeometry(e.routes[0].coordinates);
        const distMeters = e.routes[0].summary.totalDistance;
        setDistanceKm(parseFloat((distMeters / 1000).toFixed(1)));
      });

      routingControlRef.current.on("waypointschanged", (e) => {
        const waypoints = e.waypoints.filter((wp) => wp.latLng !== null);
        if (waypoints.length > 3) {
          alert(
            "Route too complex! Please select only ONE custom turning point.",
          );
          routingControlRef.current.setWaypoints([
            waypoints[0].latLng,
            collegeLocation,
          ]);
        }
      });

      routingControlRef.current.on("routingerror", () => {
        alert(
          "Invalid route! Cannot drive through this area. Reverting to main road.",
        );
        const waypoints = routingControlRef.current.getWaypoints();
        routingControlRef.current.setWaypoints([
          waypoints[0].latLng,
          collegeLocation,
        ]);
      });
    }
  }, []);

  useEffect(() => {
    let locationPushInterval = null;
    let liveDataInterval = null;
    let isPushingLocation = false;

    if (currentRideId) {
      // Initialize native WebSocket connection
      wsRef.current = new WebSocket(
        `ws://localhost:7070/ws/rides/${currentRideId}/live`,
      );

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "CHAT_MESSAGE") {
            setChatMessages((prev) => [...prev, data]);
          } else if (data.type === "SOS_ALERT") {
            alert("🚨 SOS EMERGENCY TRIGGERED FOR THIS RIDE!");
          } else if (data.type === "NEW_BOOKING_REQUEST") {
            alert("🔔 New booking request from " + data.name);
            fetchBookings(); // Fetch new bookings immediately
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };

      const fetchBookings = () => {
        fetch(`http://localhost:7070/api/rides/${currentRideId}/bookings`, {
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => setBookings(data || []))
          .catch(console.error);
      };
      fetchBookings();

      // Fetch chat history
      fetch(`http://localhost:7070/api/rides/${currentRideId}/chat`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setChatMessages(data))
        .catch((err) => console.error(err));

      // 1. Efficient non-blocking location push every 2.5s
      locationPushInterval = setInterval(() => {
        if ("geolocation" in navigator && !isPushingLocation) {
          isPushingLocation = true;
          navigator.geolocation.getCurrentPosition(
            (position) => {
              fetch("http://localhost:7070/api/location/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  rideId: currentRideId,
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                }),
              })
                .catch((err) =>
                  console.error("Error pushing driver location:", err),
                )
                .finally(() => {
                  isPushingLocation = false;
                });
            },
            (error) => {
              console.warn(
                "Geolocation warning in driver push:",
                error.message,
              );
              isPushingLocation = false;
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 },
          );
        }
      }, 2500);

      // 2. Poll live passengers and seat updates every 3s
      liveDataInterval = setInterval(() => {
        fetch(`http://localhost:7070/api/rides/${currentRideId}/live`, {
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

            // Plot passengers
            if (mapInstance.current && data.passengers) {
              passengerMarkersRef.current.forEach((m) =>
                mapInstance.current.removeLayer(m),
              );
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
          })
          .catch((err) => console.error("Error fetching live ride data:", err));
      }, 3000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (locationPushInterval) {
        clearInterval(locationPushInterval);
      }
      if (liveDataInterval) {
        clearInterval(liveDataInterval);
      }
    };
  }, [currentRideId]);

  const handleSaveVehicle = (e) => {
    e.preventDefault();
    fetch("http://localhost:7070/api/profile/vehicle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(vehicleForm),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          setVehicle(vehicleForm);
          setShowVehicleModal(false);
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  const handlePublishRide = () => {
    if (!vehicle || !vehicle.make || !vehicle.model || !vehicle.licensePlate) {
      alert(
        "⚠️ You must complete your Vehicle Profile before offering a ride.",
      );
      setShowVehicleModal(true);
      return;
    }
    if (routeGeometry.length === 0) {
      alert("Please wait for the route to calculate before publishing.");
      return;
    }

    fetch("http://localhost:7070/api/rides/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ seats: seats }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.rideId) {
          const newRideId = data.rideId;
          // Immediately save route
          fetch(`http://localhost:7070/api/route/save/${newRideId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              routeGeometry: routeGeometry,
              distanceKm: distanceKm,
              isFreeRide: isFreeRide,
            }),
          })
            .then((resRoute) => resRoute.json())
            .then((dataRoute) => {
              if (dataRoute.message) {
                setCurrentRideId(newRideId);
                if (
                  routingControlRef.current &&
                  routingControlRef.current.getPlan()
                ) {
                  routingControlRef.current.getPlan().options.draggableWaypoints = false;
                  routingControlRef.current.getPlan().options.addWaypoints = false;
                }
                alert("✅ Ride Published and Route Saved! You are now live.");
              } else {
                alert("❌ Failed to save route: " + dataRoute.error);
              }
            });
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  const handleUpdateStatus = (newStatus) => {
    fetch(`http://localhost:7070/api/rides/${currentRideId}/status`, {
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
            alert(
              "✅ Ride Completed! Showing summary...\nDistance: " +
                distanceKm +
                "km\nEarnings: " +
                (isFreeRide
                  ? "₹0"
                  : `₹${((distanceKm * 5) / seats).toFixed(0)}/seat`),
            );
            setCurrentRideId(null);
            setRideStatus("PENDING");
            setRouteGeometry([]);
            setDistanceKm(0);
          }
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  const handleDrawNew = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const liveStart = L.latLng(
            position.coords.latitude,
            position.coords.longitude,
          );
          routingControlRef.current.setWaypoints([liveStart, collegeLocation]);
          mapInstance.current.setView(liveStart, 12);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true },
      );
    } else {
      routingControlRef.current.setWaypoints([
        L.latLng(10.5276, 76.2144),
        collegeLocation,
      ]);
    }
  };

  const fetchFavorites = (isInitial = false) => {
    fetch("http://localhost:7070/api/user/route/favorite", {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && Array.isArray(data)) {
          setFavoriteRoutes(data);
          if (isInitial && data.length > 0 && routingControlRef.current) {
            const lastRoute = data[data.length - 1];
            if (lastRoute.waypoints && lastRoute.waypoints.length > 0) {
              const waypoints = lastRoute.waypoints.map((coord) =>
                L.latLng(coord.lat, coord.lng),
              );
              routingControlRef.current.setWaypoints(waypoints);
              mapInstance.current.fitBounds(L.latLngBounds(waypoints));
            }
          }
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    // Wait slightly for map initialization before auto-loading
    setTimeout(() => {
      fetchFavorites(true);
    }, 500);
  }, []);

  const handleLoadFavorite = (index) => {
    if (index === "" || !favoriteRoutes[index]) return;
    const data = favoriteRoutes[index].waypoints;
    if (data && data.length > 0) {
      const waypoints = data.map((coord) => L.latLng(coord.lat, coord.lng));
      routingControlRef.current.setWaypoints(waypoints);
      mapInstance.current.fitBounds(L.latLngBounds(waypoints));
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
      alert("Please draw a route first!");
      return;
    }

    const routeName = window.prompt(
      "Enter a name for this favorite route:",
      "My Route",
    );
    if (!routeName) return;

    fetch("http://localhost:7070/api/user/route/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: routeName, waypoints }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("⭐ " + data.message);
          fetchFavorites();
        } else alert("❌ " + data.error);
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
    fetch("http://localhost:7070/api/rides/cancel", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          setCurrentRideId(null);
          setRouteGeometry([]);
          if (routingControlRef.current) {
            const waypoints = routingControlRef.current.getWaypoints();
            routingControlRef.current.setWaypoints([
              waypoints[0].latLng,
              collegeLocation,
            ]);
          }
        } else alert("❌ " + data.error);
      });
  };

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || !currentRideId) return;

    const msg = {
      type: "CHAT_MESSAGE",
      senderId: -1, // Backend handles token validation, but UI just needs to know it's a driver message
      senderName: "Driver",
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
    if (!currentRideId || !navigator.geolocation) return;
    if (
      !window.confirm(
        "🚨 Are you sure you want to trigger an SOS Emergency Alert? This will notify administration immediately.",
      )
    )
      return;

    navigator.geolocation.getCurrentPosition((pos) => {
      fetch(`http://localhost:7070/api/rides/${currentRideId}/sos`, {
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
          if (data.message) alert(data.message);
          else alert(data.error);
        });
    });
  };

  const handleBookingAction = (bookingId, action) => {
    fetch(`http://localhost:7070/api/bookings/${bookingId}/${action}`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          fetch(`http://localhost:7070/api/rides/${currentRideId}/bookings`, {
            credentials: "include",
          })
            .then((res) => res.json())
            .then((data) => setBookings(data || []));
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[90vh] p-4 gap-6 bg-slate-50">
      {/* Left Column: Header + Map + Map Controls */}
      <div className="flex flex-col flex-grow lg:w-[70%] h-full gap-4">
        <div className="flex justify-between items-end bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-blue-900">
            Driver: Plan Your Route
          </h1>
          <button
            onClick={() => setShowVehicleModal(true)}
            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold py-2 px-4 rounded-lg transition-colors border border-indigo-200 shadow-sm text-sm"
          >
            {vehicle ? "Edit Vehicle Profile" : "Set Vehicle Profile"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <button
            onClick={handleDrawNew}
            className="bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-sm hover:bg-slate-700"
          >
            Draw New Route
          </button>

          <select
            className="border rounded p-1.5 text-sm bg-blue-50 text-blue-800 font-bold max-w-[200px]"
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

        <div
          ref={mapRef}
          className="w-full flex-grow rounded-xl shadow-lg border-4 border-white z-0 min-h-[400px]"
        ></div>
      </div>

      {/* Right Column: Scrollable Sidebar */}
      <div className="flex flex-col lg:w-[30%] h-full overflow-y-auto gap-4 pr-2">
        {/* Step 1: Setup & Publish */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col gap-3">
          <h3 className="text-md font-bold text-slate-800 border-b pb-2">
            Step 1: Setup & Publish
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-600">
              Available Seats:
            </label>
            <input
              type="number"
              min="1"
              max="8"
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-16 p-1 border rounded text-center"
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
              className="text-sm font-bold text-emerald-600"
            >
              🌱 Free Ride (No Fee)
            </label>
          </div>
          <div className="text-sm font-semibold mb-2">
            Fare:{" "}
            {isFreeRide
              ? "₹0"
              : `₹${((distanceKm * 5) / seats).toFixed(0)} / seat`}
          </div>
          <button
            onClick={handlePublishRide}
            disabled={currentRideId !== null}
            className={`font-bold py-2 px-4 rounded-lg shadow-md text-sm w-full ${
              currentRideId
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
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
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col gap-3">
          <h3 className="text-md font-bold text-slate-800 border-b pb-2">
            Step 2: Passengers
          </h3>
          {!currentRideId ? (
            <p className="text-xs text-slate-500">
              Publish ride to receive bookings.
            </p>
          ) : bookings.length === 0 ? (
            <p className="text-xs text-slate-500">No bookings yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {bookings.map((b) => (
                <div
                  key={b.bookingId}
                  className="border p-2 rounded-lg text-sm bg-slate-50 flex flex-col gap-2"
                >
                  <div className="font-bold">
                    {b.passengerName}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      ({b.status})
                    </span>
                  </div>

                  {b.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleBookingAction(b.bookingId, "accept")
                        }
                        className="flex-1 bg-green-500 text-white text-xs font-bold py-1 rounded"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() =>
                          handleBookingAction(b.bookingId, "reject")
                        }
                        className="flex-1 bg-red-500 text-white text-xs font-bold py-1 rounded"
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
                    <div className="text-xs text-green-600 font-bold text-center">
                      Passenger Notified
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Ride Status */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col gap-3">
          <h3 className="text-md font-bold text-slate-800 border-b pb-2">
            Step 3: Ride Status
          </h3>
          {currentRideId ? (
            <div className="flex flex-col gap-2">
              {rideStatus === "PENDING" && (
                <button
                  onClick={() => handleUpdateStatus("IN_TRANSIT")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow"
                >
                  🚗 Start Driving
                </button>
              )}
              {rideStatus === "IN_TRANSIT" && (
                <button
                  onClick={() => handleUpdateStatus("COMPLETED")}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded shadow"
                >
                  🏁 Complete Ride
                </button>
              )}
              <div className="border-t pt-3 mt-1">
                <button
                  onClick={handleSos}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow animate-pulse"
                >
                  🚨 SOS Emergency
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Create a route to manage status.
            </p>
          )}
        </div>
      </div>

      {/* Modals & Chat */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">
              Vehicle Profile
            </h2>
            <form onSubmit={handleSaveVehicle} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Make
                </label>
                <input
                  required
                  type="text"
                  value={vehicleForm.make}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, make: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Model
                </label>
                <input
                  required
                  type="text"
                  value={vehicleForm.model}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, model: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
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
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Color
                </label>
                <input
                  required
                  type="text"
                  value={vehicleForm.color}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, color: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="flex-1 py-2 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentRideId && (
        <div className="absolute bottom-10 right-10 z-[2000] flex flex-col items-end">
          {isChatOpen ? (
            <div className="bg-white w-80 h-96 rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
              <div
                className="bg-blue-600 text-white p-3 font-bold flex justify-between items-center cursor-pointer"
                onClick={() => setIsChatOpen(false)}
              >
                <span>Ride Chat</span>
                <span>▼</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-slate-50">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.senderName === "Driver" ? "bg-blue-100 self-end rounded-br-none" : "bg-white border self-start rounded-bl-none"}`}
                  >
                    <div className="font-bold text-xs text-slate-500">
                      {msg.senderName}
                    </div>
                    <div>{msg.text}</div>
                    <div className="text-[10px] text-slate-400 text-right mt-1">
                      {msg.timestamp}
                    </div>
                  </div>
                ))}
                <div
                  ref={(el) => {
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                ></div>
              </div>
              <form
                onSubmit={handleSendChatMessage}
                className="p-2 border-t flex gap-2 bg-white"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type message..."
                  className="flex-1 p-2 border rounded text-sm"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-3 rounded font-bold"
                >
                  Send
                </button>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setIsChatOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-2xl flex items-center justify-center animate-bounce relative"
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
  );
};

export default DriverDashboard;
