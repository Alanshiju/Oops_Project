import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE_URL } from "../config/api";
import { motion } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { toast } from "react-toastify";
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("verification");
  const { settings, refreshSettings } = useSettings();
  const [contactForm, setContactForm] = useState({
    phone: "",
    email: "",
    facebook: "",
    instagram: "",
  }); // 'verification', 'audit', 'users'
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [statusMessage, setStatusMessage] = useState(
    "Loading pending verifications...",
  );

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState("ALL");
  const [incidentModal, setIncidentModal] = useState(null);

  const [auditPage, setAuditPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const itemsPerPage = 10;

  const [socialLinks, setSocialLinks] = useState({
    whatsapp: "",
    facebook: "",
    instagram: "",
  });
  const [isUpdatingSocial, setIsUpdatingSocial] = useState(false);

  const fetchSocialLinks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/social`);
      if (!res.ok) {
        console.warn(`Fetching social links failed with status: ${res.status}`);
        return;
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (data && typeof data === "object") {
          setSocialLinks((prev) => ({ ...prev, ...data }));
        }
      } else {
        console.warn("Expected JSON for social links but received plain text.");
      }
    } catch (err) {
      console.error("Error fetching social links:", err);
    }
  };

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const handleUpdateSocialLinks = async (e) => {
    e.preventDefault();
    setIsUpdatingSocial(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/settings/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(socialLinks),
      });
      setIsUpdatingSocial(false);
      const contentType = res.headers.get("content-type");
      if (
        res.ok &&
        contentType &&
        contentType.indexOf("application/json") !== -1
      ) {
        const data = await res.json();
        if (data.message) {
          toast.success(data.message);
        } else {
          toast.error(data.error || "Failed to update social links");
        }
      } else {
        toast.error(
          "Failed to update social links (Server error: " + res.status + ")",
        );
      }
    } catch (err) {
      setIsUpdatingSocial(false);
      toast.error("Error contacting server: " + err.message);
    }
  };

  const [campusDestination, setCampusDestination] = useState(null);
  const [isUpdatingDest, setIsUpdatingDest] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const fetchDestination = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/destination`);
      if (!res.ok) {
        console.warn(
          `Endpoint /api/settings/destination failed with status: ${res.status}`,
        );
        setCampusDestination(null);
        return;
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        setCampusDestination(data);
      } else {
        console.warn("Expected JSON but received plain text for destination.");
        setCampusDestination(null);
      }
    } catch (err) {
      console.error("Error fetching destination:", err);
      setCampusDestination(null);
    }
  };

  useEffect(() => {
    fetchDestination();
  }, []);

  const handleSetCampusDestination = () => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsUpdatingDest(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/admin/settings/location`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(coords),
            },
          );
          setIsUpdatingDest(false);
          const contentType = res.headers.get("content-type");
          if (
            res.ok &&
            contentType &&
            contentType.indexOf("application/json") !== -1
          ) {
            const data = await res.json();
            if (data.message) {
              refreshSettings();
              alert("✅ " + data.message);
              setCampusDestination(coords);
            } else {
              alert("❌ " + (data.error || "Failed to update destination"));
            }
          } else {
            alert("❌ Server returned non-JSON response (" + res.status + ")");
          }
        } catch (err) {
          setIsUpdatingDest(false);
          alert("Error contacting server: " + err.message);
        }
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

  useEffect(() => {
    if (settings && settings.contact) {
      setContactForm({
        phone: settings.contact.phone || "",
        email: settings.contact.email || "",
        facebook: settings.contact.facebook || "",
        instagram: settings.contact.instagram || "",
      });
    }
  }, [settings]);

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pending`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        console.warn(
          `Endpoint /api/admin/pending failed with status: ${res.status}`,
        );
        setPendingUsers([]);
        setStatusMessage("Failed to load pending verifications.");
        return;
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPendingUsers(data);
          if (data.length === 0) {
            setStatusMessage("No pending verifications at this time.");
          }
        } else {
          setPendingUsers([]);
          setStatusMessage("No pending verifications at this time.");
        }
      } else {
        console.warn(
          "Expected JSON but received plain text for pending users.",
        );
        setPendingUsers([]);
        setStatusMessage("Error loading pending verifications.");
      }
    } catch (err) {
      console.error("Error fetching pending users:", err);
      setPendingUsers([]);
      setStatusMessage("Error connecting to the server.");
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/rides/audit`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        console.warn(
          `Endpoint /api/admin/rides/audit failed with status: ${res.status}`,
        );
        setAuditLogs([]);
        return;
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      } else {
        console.warn("Expected JSON but received plain text for audit logs.");
        setAuditLogs([]);
      }
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setAuditLogs([]);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.warn(
          `Endpoint /api/admin/users failed with status: ${res.status}`,
        );
        setAllUsers([]);
        return;
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllUsers(data);
        } else if (data && !data.error && Array.isArray(data.users)) {
          setAllUsers(data.users);
        } else {
          setAllUsers([]);
        }
      } else {
        console.warn("Expected JSON but received plain text for users.");
        setAllUsers([]);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setAllUsers([]);
    }
  };

  const handleToggleVerification = async (userId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}/status`,
        {
          method: "PUT",
          credentials: "include",
        },
      );
      const contentType = res.headers.get("content-type");
      if (
        res.ok &&
        contentType &&
        contentType.indexOf("application/json") !== -1
      ) {
        const data = await res.json();
        if (data.message) {
          fetchAllUsers();
        } else {
          alert(
            "Error: " + (data.error || "Failed to update user verification"),
          );
        }
      } else {
        alert("Server error (" + res.status + ") updating user status");
      }
    } catch (err) {
      console.error("Error toggling user verification:", err);
      alert("Error contacting server: " + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (
      !window.confirm(
        "⚠️ DANGER: Are you sure you want to completely delete this user and all their associated rides, bookings, and incident reports? This action cannot be undone.",
      )
    )
      return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const contentType = res.headers.get("content-type");
      if (
        res.ok &&
        contentType &&
        contentType.indexOf("application/json") !== -1
      ) {
        const data = await res.json();
        if (data.message) {
          alert("✅ " + data.message);
          fetchAllUsers();
        } else {
          alert("❌ " + (data.error || "Failed to delete user"));
        }
      } else {
        alert("Server error (" + res.status + ") deleting user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Error contacting server: " + err.message);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/approve/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      const contentType = res.headers.get("content-type");
      if (
        res.ok &&
        contentType &&
        contentType.indexOf("application/json") !== -1
      ) {
        const data = await res.json();
        if (data.message) {
          alert("✅ " + data.message);
          setPendingUsers((prev) =>
            Array.isArray(prev)
              ? prev.filter((user) => user.userId !== userId)
              : [],
          );
        } else {
          alert("❌ " + (data.error || "Failed to approve user"));
        }
      } else {
        alert("Server error (" + res.status + ") approving user");
      }
    } catch (err) {
      console.error("Error approving user:", err);
      alert("Error contacting server: " + err.message);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/settings/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(contactForm),
      });
      const contentType = res.headers.get("content-type");
      if (
        res.ok &&
        contentType &&
        contentType.indexOf("application/json") !== -1
      ) {
        const data = await res.json();
        if (data.message) {
          alert("✅ " + data.message);
          refreshSettings();
        } else {
          alert("❌ " + (data.error || "Failed to save contact settings"));
        }
      } else {
        alert("Server error (" + res.status + ") saving contact settings");
      }
    } catch (err) {
      console.error("Error saving contact settings:", err);
      alert("Error contacting server: " + err.message);
    }
  };

  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const filteredLogs = safeAuditLogs.filter((log) => {
    if (auditFilter === "ALL") return true;
    if (auditFilter === "EMERGENCY") return log.isEmergency;
    return log.status === auditFilter;
  });

  const totalAuditPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const currentAuditPage = Math.min(auditPage, totalAuditPages);
  const paginatedLogs = filteredLogs.slice(
    (currentAuditPage - 1) * itemsPerPage,
    currentAuditPage * itemsPerPage,
  );

  const safeAllUsers = Array.isArray(allUsers) ? allUsers : [];
  const totalUserPages = Math.ceil(safeAllUsers.length / itemsPerPage) || 1;
  const currentUserPage = Math.min(userPage, totalUserPages);
  const paginatedUsers = safeAllUsers.slice(
    (currentUserPage - 1) * itemsPerPage,
    currentUserPage * itemsPerPage,
  );

  const safePendingUsers = Array.isArray(pendingUsers) ? pendingUsers : [];
  const totalPendingPages =
    Math.ceil(safePendingUsers.length / itemsPerPage) || 1;
  const currentPendingPage = Math.min(pendingPage, totalPendingPages);
  const paginatedPending = safePendingUsers.slice(
    (currentPendingPage - 1) * itemsPerPage,
    currentPendingPage * itemsPerPage,
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] items-start gap-8">
        <div className="flex flex-col gap-3 lg:sticky lg:top-24 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-black/40 p-5">
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-1">
            Admin Command Center
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-4">
            Verify identities and monitor campus ride safety.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setActiveTab("verification");
                setPendingPage(1);
              }}
              className={`px-4 py-3 rounded-full font-bold text-sm text-left transition-all ${activeTab === "verification" ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
            >
              User Verification
            </button>
            <button
              onClick={() => {
                setActiveTab("audit");
                setAuditPage(1);
              }}
              className={`px-4 py-3 rounded-full font-bold text-sm text-left transition-all ${activeTab === "audit" ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
            >
              Audit & Safety Logs
            </button>
            <button
              onClick={() => {
                setActiveTab("users");
                setUserPage(1);
              }}
              className={`px-4 py-3 rounded-full font-bold text-sm text-left transition-all ${activeTab === "users" ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab("cms")}
              className={`px-4 py-3 rounded-full font-bold text-sm text-left transition-all ${activeTab === "cms" ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
            >
              Site CMS
            </button>
          </div>
        </div>

        {/* Right Column */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full flex flex-col gap-6"
        >
          {activeTab === "cms" && (
            <div className="w-full flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                  Campus Geofence
                </h3>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                      <span>📍 Campus Drop-Off Destination:</span>
                      <span className="font-mono text-xs bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-3 py-1.5 rounded-full border border-teal-200 dark:border-teal-800 mt-2 block w-fit">
                        {settings?.location
                          ? `${settings.location.lat.toFixed(4)}, ${settings.location.lng.toFixed(4)}`
                          : "Loading..."}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      All driver routes automatically lock their final drop-off
                      point to this coordinate.
                    </p>
                  </div>
                  <button
                    onClick={handleSetCampusDestination}
                    disabled={isUpdatingDest}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold py-3 px-5 rounded-full shadow-md shadow-teal-700/20 text-sm transition-transform active:scale-95 flex items-center gap-2"
                  >
                    {isUpdatingDest
                      ? "Acquiring GPS..."
                      : "📍 Set Destination to Current GPS"}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                  Contact & Socials
                </h3>
                <form
                  onSubmit={handleSaveContact}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={contactForm.phone}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          phone: e.target.value,
                        })
                      }
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 dark:bg-slate-700/60 dark:text-white"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          email: e.target.value,
                        })
                      }
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 dark:bg-slate-700/60 dark:text-white"
                      placeholder="admin@campus.edu"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      Facebook URL
                    </label>
                    <input
                      type="url"
                      value={contactForm.facebook}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          facebook: e.target.value,
                        })
                      }
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 dark:bg-slate-700/60 dark:text-white"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      Instagram URL
                    </label>
                    <input
                      type="url"
                      value={contactForm.instagram}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          instagram: e.target.value,
                        })
                      }
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 dark:bg-slate-700/60 dark:text-white"
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end mt-2">
                    <button
                      type="submit"
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-full shadow-md shadow-teal-700/20 transition-transform active:scale-95"
                    >
                      Save Contact Details
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === "verification" && (
            <div className="w-full">
              {pendingUsers.length === 0 ? (
                <div className="text-xl font-bold text-slate-400 mt-10 text-center">
                  {statusMessage}
                </div>
              ) : (
                <div className="w-full flex flex-col">
                  <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {paginatedPending.map((user) => (
                      <div
                        key={user.userId}
                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-black/40 border border-slate-200 dark:border-slate-700 relative overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                            {user.name}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            {user.email} • {user.role}
                          </p>

                          <div className="flex gap-4 mb-6">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-700/60 h-32 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs text-slate-400 dark:text-slate-300 text-center p-2">
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
                            <div className="flex-1 bg-slate-100 dark:bg-slate-700/60 h-32 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs text-slate-400 dark:text-slate-300 text-center p-2">
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

                  {pendingUsers.length > itemsPerPage && (
                    <div className="flex justify-between items-center mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() =>
                          setPendingPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPendingPage === 1}
                        className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                      >
                        Previous
                      </button>
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Page {currentPendingPage} of {totalPendingPages}
                      </span>
                      <button
                        onClick={() =>
                          setPendingPage((p) =>
                            Math.min(totalPendingPages, p + 1),
                          )
                        }
                        disabled={currentPendingPage >= totalPendingPages}
                        className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-black/40">
              <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
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
                    onClick={() => {
                      setAuditFilter(f);
                      setAuditPage(1);
                    }}
                    className={`px-4 py-1 rounded text-xs font-bold ${auditFilter === f ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40 mt-4">
                <div className="w-full overflow-x-auto pb-2">
                  <table className="w-full min-w-[600px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-200 text-sm border-b-2 border-slate-200 dark:border-slate-700">
                        <th className="p-3">Ride ID</th>
                        <th className="p-3">Driver</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Distance</th>
                        <th className="p-3">Emergency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr
                          key={log.rideId}
                          className={`border-b border-slate-100 dark:border-slate-700 text-sm ${log.isEmergency ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 shadow-[inset_0_0_10px_rgba(220,38,38,0.2)]" : "hover:bg-slate-50/50 dark:hover:bg-slate-700/40 transition-colors"}`}
                        >
                          <td className="p-3 font-bold text-slate-700 dark:text-slate-200">
                            #{log.rideId}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {log.driverName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
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
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
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
                </div>
                {filteredLogs.length === 0 && (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    No logs found for this filter.
                  </div>
                )}
                {filteredLogs.length > 0 && (
                  <div className="flex justify-between items-center mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-b-2xl border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={currentAuditPage === 1}
                      className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Page {currentAuditPage} of {totalAuditPages}
                    </span>
                    <button
                      onClick={() =>
                        setAuditPage((p) => Math.min(totalAuditPages, p + 1))
                      }
                      disabled={currentAuditPage >= totalAuditPages}
                      className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TASK 2: USER MANAGEMENT TAB --- */}
          {activeTab === "users" && (
            <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-teal-900 dark:text-white">
                  User Management
                </h3>
                <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold px-3 py-1 rounded-full text-sm">
                  Total: {allUsers.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40 mt-4">
                <div className="w-full overflow-x-auto pb-2">
                  <table className="w-full min-w-[600px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-200 text-sm border-b-2 border-slate-200 dark:border-slate-700">
                        <th className="p-3">ID / Name</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user) => (
                        <tr
                          key={user.user_id}
                          className="border-b border-slate-100 dark:border-slate-700 text-sm hover:bg-slate-50/50 dark:hover:bg-slate-700/40 transition-colors"
                        >
                          <td className="p-3">
                            <div className="font-bold text-slate-800 dark:text-white">
                              {user.name}
                            </div>
                            <div className="text-xs font-mono text-slate-400">
                              ID: {user.user_id}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-blue-700 dark:text-blue-400">
                              {user.email}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {user.phone || "No phone"}
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                user.role === "ADMIN"
                                  ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300"
                                  : user.role === "DRIVER"
                                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                user.is_verified
                                  ? "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300"
                                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                              }`}
                            >
                              {user.is_verified ? "Verified" : "Unverified"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleToggleVerification(user.user_id)
                                }
                                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold px-3 py-1.5 rounded text-xs transition"
                              >
                                {user.is_verified ? "Revoke" : "Verify"}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.user_id)}
                                className="bg-red-100 dark:bg-red-950/60 hover:bg-red-600 hover:text-white text-red-700 dark:text-red-300 font-bold px-3 py-1.5 rounded text-xs transition"
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
                </div>
                {allUsers.length === 0 && (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    No users found.
                  </div>
                )}
                {allUsers.length > 0 && (
                  <div className="flex justify-between items-center mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-b-2xl border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={currentUserPage === 1}
                      className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Page {currentUserPage} of {totalUserPages}
                    </span>
                    <button
                      onClick={() =>
                        setUserPage((p) => Math.min(totalUserPages, p + 1))
                      }
                      disabled={currentUserPage >= totalUserPages}
                      className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Incident Modal */}
          {incidentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
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
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
