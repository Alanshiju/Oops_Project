import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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
  const [liveRideStatus, setLiveRideStatus] = useState("PENDING");
  const [distanceKm, setDistanceKm] = useState(0);

  // Chat & SOS States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const wsRef = useRef(null);

  const [currentGps, setCurrentGps] = useState(null);

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = () => {
    fetch("http://localhost:7070/api/bookings/my-rides", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMyBookings(data);
          if (data.length > 0) {
            setActiveRideId(data[0].rideId);
          } else {
            setActiveRideId(null);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch bookings", err));
  };

  useEffect(() => {
    let ws = null;

    if (activeTab === "history" && myBookings.length > 0) {
      const activeRideId = myBookings[0].rideId;

      if (!mapInstance.current && mapRef.current) {
        mapInstance.current = L.map(mapRef.current).setView(
          [10.5276, 76.2144],
          12,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstance.current);
      }

      // Plot user location
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          const userPos = [position.coords.latitude, position.coords.longitude];
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
        });
      }

      // Initialize native WebSocket connection for live driver updates
      wsRef.current = new WebSocket(
        `ws://localhost:7070/ws/rides/${activeRideId}/live`,
      );

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data && data.type === "STATUS_UPDATE") {
            setLiveRideStatus(data.status);
            if (data.status === "COMPLETED") {
              setTimeout(() => fetchMyBookings(), 3000);
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

          if (data && data.lat !== undefined && data.lng !== undefined) {
            const currentStatus =
              myBookings.length > 0 ? myBookings[0].status : null;
            if (currentStatus === "PENDING") return; // Hide live tracking until accepted

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
  }, [activeTab, myBookings]);

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
          setActiveTab("history");
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
          if (data.message) alert(data.message);
          else alert(data.error);
        });
    });
  };

  return (
    <div className="flex flex-col items-center mt-10 w-full max-w-3xl mx-auto">
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
          My Bookings ({myBookings.length})
        </button>
      </div>

      {activeTab === "search" && (
        <>
          <div className="bg-white p-8 rounded-2xl shadow-lg w-full border border-slate-200 text-center mb-8">
            <h2 className="text-3xl font-extrabold text-blue-900 mb-4">
              Find a Ride to Campus
            </h2>
            <p className="text-slate-600 mb-6 font-medium">{searchStatus}</p>

            <button
              onClick={handleSearchRides}
              disabled={isSearching}
              className={`px-8 py-3 rounded-lg font-bold text-white transition-all shadow-md ${
                isSearching
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 active:scale-95"
              }`}
            >
              {isSearching
                ? "Scanning Route Data..."
                : "Scan My Area for Rides"}
            </button>
          </div>

          <div className="w-full flex flex-col gap-4">
            {isSearching ? (
              <div className="animate-pulse flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex justify-between items-center"
                  >
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
                ))}
              </div>
            ) : (
              rides.map((ride) => (
                <div
                  key={ride.rideId}
                  className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow flex justify-between items-center"
                >
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
                          {ride.carColor || ""} {ride.vehicleMake || "Unknown"}{" "}
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

                  <button
                    onClick={() => handleBookSeat(ride.rideId)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95"
                  >
                    Book Seat
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "history" && (
        <div className="w-full flex flex-col gap-4">
          {myBookings.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center text-slate-500 font-medium">
              You haven't booked any rides yet.
            </div>
          ) : (
            <>
              {myBookings.map((booking, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-xl shadow-md border-l-8 border-blue-500 flex justify-between items-center"
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Driver: {booking.driverName}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Ride #{booking.rideId} | Booking #{booking.bookingId}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-extrabold tracking-wide text-sm">
                      {booking.status}
                    </div>
                    <button
                      onClick={handleCancelBooking}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow text-sm"
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>
              ))}
              <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-blue-900">
                    Live Tracking
                  </h3>
                  {liveRideStatus === "DRIVER_ARRIVED" && (
                    <div className="bg-amber-100 text-amber-800 border border-amber-500 font-bold px-4 py-1.5 rounded shadow-sm text-sm">
                      📍 Driver Arrived
                    </div>
                  )}
                  {liveRideStatus === "IN_TRANSIT" && (
                    <div className="bg-blue-100 text-blue-800 border border-blue-500 font-bold px-4 py-1.5 rounded shadow-sm flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      In Transit
                    </div>
                  )}
                  {liveRideStatus === "COMPLETED" && (
                    <div className="bg-purple-100 text-purple-800 border border-purple-500 font-bold px-4 py-1.5 rounded shadow-sm text-sm">
                      🏁 Ride Completed
                    </div>
                  )}
                </div>
                <div className="relative w-full h-[400px]">
                  <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleRefocusMap}
                      className="bg-white px-4 py-2 rounded shadow font-bold text-blue-900 hover:bg-slate-50 transition border border-slate-200 text-sm active:scale-95"
                    >
                      Refocus Map
                    </button>
                    <button
                      type="button"
                      onClick={handleSos}
                      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded shadow font-bold text-white transition text-sm active:scale-95 animate-pulse"
                    >
                      🚨 SOS
                    </button>
                  </div>
                  <div
                    ref={mapRef}
                    className="w-full h-full rounded-lg border-2 border-slate-200"
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Chat Widget */}
      {activeRideId && (
        <div className="fixed bottom-10 right-10 z-[2000] flex flex-col items-end">
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
                    className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.senderName === "Student" ? "bg-blue-100 self-end rounded-br-none" : "bg-white border self-start rounded-bl-none"}`}
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
              className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center text-2xl relative"
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
