import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("verification"); // 'verification', 'audit', 'users'
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [statusMessage, setStatusMessage] = useState(
    "Loading pending verifications...",
  );

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState("ALL");
  const [incidentModal, setIncidentModal] = useState(null);

  const [socialLinks, setSocialLinks] = useState({
    whatsapp: "",
    facebook: "",
    instagram: "",
  });
  const [isUpdatingSocial, setIsUpdatingSocial] = useState(false);

  useEffect(() => {
    fetch("http://localhost:7070/api/settings/social")
      .then((res) => res.json())
      .then((data) => setSocialLinks(data))
      .catch((err) => console.error("Error fetching social links", err));
  }, []);

  const handleUpdateSocialLinks = (e) => {
    e.preventDefault();
    setIsUpdatingSocial(true);
    fetch("http://localhost:7070/api/admin/settings/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(socialLinks),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsUpdatingSocial(false);
        if (data.message) {
          toast.success(data.message);
        } else {
          toast.error(data.error || "Failed to update social links");
        }
      })
      .catch((err) => {
        setIsUpdatingSocial(false);
        toast.error("Error contacting server: " + err.message);
      });
  };

  const [campusDestination, setCampusDestination] = useState(null);
  const [isUpdatingDest, setIsUpdatingDest] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    fetchDestination();
  }, []);

  const fetchDestination = () => {
    fetch("http://localhost:7070/api/settings/destination")
      .then((res) => res.json())
      .then((data) => setCampusDestination(data))
      .catch((err) => console.error("Error fetching destination", err));
  };

  const handleSetCampusDestination = () => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsUpdatingDest(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        fetch("http://localhost:7070/api/admin/settings/destination", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(coords),
        })
          .then((res) => res.json())
          .then((data) => {
            setIsUpdatingDest(false);
            if (data.message) {
              alert("✅ " + data.message);
              setCampusDestination(coords);
            } else {
              alert("❌ " + (data.error || "Failed to update destination"));
            }
          })
          .catch((err) => {
            setIsUpdatingDest(false);
            alert("Error contacting server: " + err.message);
          });
      },
      (err) => {
        setIsUpdatingDest(false);
        alert("Failed to acquire GPS location: " + err.message);
      },
      { enableHighAccuracy: true },
    );
  };

  useEffect(() => {
    if (activeTab === "verification") {
      fetchPendingUsers();
    } else if (activeTab === "audit") {
      fetchAuditLogs();
    } else if (activeTab === "users") {
      fetchAllUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (incidentModal && mapRef.current) {
      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current).setView(
          [incidentModal.lat, incidentModal.lng],
          15,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstance.current);
      } else {
        mapInstance.current.setView([incidentModal.lat, incidentModal.lng], 15);
      }

      // Add SOS Marker
      L.marker([incidentModal.lat, incidentModal.lng], {
        icon: L.divIcon({
          className: "custom-div-icon",
          html: `<div class="w-6 h-6 bg-red-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse flex items-center justify-center"><span class="text-white text-xs">SOS</span></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .addTo(mapInstance.current)
        .bindPopup("SOS Location");

      // Draw Route Geometry if available
      if (incidentModal.route && incidentModal.route.length > 0) {
        const polyline = L.polyline(incidentModal.route, {
          color: "blue",
          weight: 4,
        }).addTo(mapInstance.current);
        mapInstance.current.fitBounds(polyline.getBounds());
      }
    }

    return () => {
      if (!incidentModal && mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [incidentModal]);

  const fetchPendingUsers = () => {
    fetch("http://localhost:7070/api/admin/pending", {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setPendingUsers(data);
        if (data.length === 0)
          setStatusMessage("No pending verifications at this time.");
      })
      .catch((err) => setStatusMessage("Error connecting to the server."));
  };

  const fetchAuditLogs = () => {
    fetch("http://localhost:7070/api/admin/rides/audit", {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setAuditLogs(data))
      .catch((err) => console.error("Error fetching audit logs", err));
  };

  const fetchAllUsers = () => {
    fetch("http://localhost:7070/api/admin/users", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setAllUsers(data);
      });
  };

  const handleToggleVerification = (userId) => {
    fetch(`http://localhost:7070/api/admin/users/${userId}/status`, {
      method: "PUT",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          fetchAllUsers();
        } else {
          alert("Error: " + data.error);
        }
      });
  };

  const handleDeleteUser = (userId) => {
    if (
      !window.confirm(
        "⚠️ DANGER: Are you sure you want to completely delete this user and all their associated rides, bookings, and incident reports? This action cannot be undone.",
      )
    )
      return;

    fetch(`http://localhost:7070/api/admin/users/${userId}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          fetchAllUsers();
        } else {
          alert("❌ " + data.error);
        }
      });
  };

  const handleApprove = (userId) => {
    fetch(`http://localhost:7070/api/admin/approve/${userId}`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          setPendingUsers(
            pendingUsers.filter((user) => user.userId !== userId),
          );
        } else alert("❌ " + data.error);
      });
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditFilter === "ALL") return true;
    if (auditFilter === "EMERGENCY") return log.isEmergency;
    return log.status === auditFilter;
  });

  return (
    <div className="flex flex-col items-center mt-10 w-full max-w-6xl mx-auto px-4 relative">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-lg w-full mb-6">
        <h2 className="text-3xl font-extrabold text-white mb-2">
          Admin Command Center
        </h2>
        <p className="text-slate-400 font-medium">
          Verify identities and monitor campus ride safety.
        </p>

        <div className="flex gap-4 mt-6">
          <button
            onClick={() => setActiveTab("verification")}
            className={`px-6 py-2 rounded font-bold transition-all ${activeTab === "verification" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            User Verification
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-6 py-2 rounded font-bold transition-all ${activeTab === "audit" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            Audit & Safety Logs
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2 rounded font-bold transition-all ${activeTab === "users" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            User Management
          </button>
        </div>

        {/* Task 4: Dynamic Admin CMS Destination */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>📍 Campus Drop-Off Destination:</span>
              <span className="font-mono text-xs bg-slate-800 text-blue-400 px-2 py-1 rounded border border-slate-700">
                {campusDestination
                  ? `${campusDestination.lat.toFixed(4)}, ${campusDestination.lng.toFixed(4)}`
                  : "Loading..."}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              All driver routes automatically lock their final drop-off point to
              this coordinate.
            </p>
          </div>
          <button
            onClick={handleSetCampusDestination}
            disabled={isUpdatingDest}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-lg shadow text-sm transition-all active:scale-95 flex items-center gap-2"
          >
            {isUpdatingDest
              ? "Acquiring GPS..."
              : "📍 Set Destination to Current GPS"}
          </button>
        </div>
      </div>

      {activeTab === "verification" && (
        <div className="w-full">
          {pendingUsers.length === 0 ? (
            <div className="text-xl font-bold text-slate-400 mt-10 text-center">
              {statusMessage}
            </div>
          ) : (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingUsers.map((user) => (
                <div
                  key={user.userId}
                  className="bg-white p-6 rounded-xl shadow-md border-t-8 border-yellow-400 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      {user.name}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      {user.email} • {user.role}
                    </p>

                    <div className="flex gap-4 mb-6">
                      <div className="flex-1 bg-slate-100 h-32 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 text-center p-2">
                        {user.collegeIdUrl ? (
                          <img
                            src={user.collegeIdUrl}
                            alt="College ID"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          "No ID"
                        )}
                      </div>
                      <div className="flex-1 bg-slate-100 h-32 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 text-center p-2">
                        {user.verificationPhotoUrl ? (
                          <img
                            src={user.verificationPhotoUrl}
                            alt="Selfie"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          "No Selfie"
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApprove(user.userId)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow transition-colors active:scale-95"
                  >
                    Approve & Verify User
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <div className="w-full bg-white p-6 rounded-xl shadow-md border border-slate-200">
          <div className="flex gap-2 mb-6 border-b pb-4">
            {[
              "ALL",
              "PENDING",
              "IN_TRANSIT",
              "COMPLETED",
              "CANCELLED",
              "EMERGENCY",
            ].map((f) => (
              <button
                key={f}
                onClick={() => setAuditFilter(f)}
                className={`px-4 py-1 rounded text-xs font-bold ${auditFilter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b-2">
                  <th className="p-3">Ride ID</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Distance</th>
                  <th className="p-3">Emergency</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log.rideId}
                    className={`border-b text-sm ${log.isEmergency ? "bg-red-50 border-red-200 shadow-[inset_0_0_10px_rgba(220,38,38,0.2)]" : "hover:bg-slate-50"}`}
                  >
                    <td className="p-3 font-bold text-slate-700">
                      #{log.rideId}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        {log.driverName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {log.driverEmail}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${log.status === "COMPLETED" ? "bg-purple-100 text-purple-800" : log.status === "CANCELLED" ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-800"}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {log.distanceKm} km
                    </td>
                    <td className="p-3">
                      {log.isEmergency && log.incident ? (
                        <button
                          onClick={() =>
                            setIncidentModal({
                              lat: log.incident.lat,
                              lng: log.incident.lng,
                              route: log.routeGeometry,
                            })
                          }
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded shadow text-xs animate-pulse"
                        >
                          Inspect Incident
                        </button>
                      ) : (
                        <span className="text-slate-400">Clear</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLogs.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                No logs found for this filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TASK 2: USER MANAGEMENT TAB --- */}
      {activeTab === "users" && (
        <div className="w-full bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-extrabold text-blue-900">
              User Management
            </h3>
            <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">
              Total: {allUsers.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b-2">
                  <th className="p-3">ID / Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b text-sm hover:bg-slate-50"
                  >
                    <td className="p-3">
                      <div className="font-bold text-slate-800">
                        {user.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        ID: {user.user_id}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-blue-700">
                        {user.email}
                      </div>
                      <div className="text-xs text-slate-500">
                        {user.phone || "No phone"}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : user.role === "DRIVER"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          user.is_verified
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {user.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleVerification(user.user_id)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded text-xs transition"
                        >
                          {user.is_verified ? "Revoke" : "Verify"}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.user_id)}
                          className="bg-red-100 hover:bg-red-600 hover:text-white text-red-700 font-bold px-3 py-1.5 rounded text-xs transition"
                          title="Delete user permanently"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allUsers.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                Loading users...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incident Modal */}
      {incidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-xl flex items-center gap-2">
                🚨 SOS Incident Inspection
              </h3>
              <button
                onClick={() => setIncidentModal(null)}
                className="font-bold hover:text-red-200"
              >
                Close ✕
              </button>
            </div>
            <div className="h-[500px] w-full" ref={mapRef}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
