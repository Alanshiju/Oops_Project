import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRole }) => {
  const [authStatus, setAuthStatus] = useState(null); // null = loading

  useEffect(() => {
    // Ask the Java backend to verify our HttpOnly cookie
    fetch("http://localhost:7070/api/check-auth", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { isAuthenticated: false }))
      .then((data) => {
        setAuthStatus(data);
      })
      .catch(() => setAuthStatus({ isAuthenticated: false }));
  }, []);

  // 1. Waiting for the server to reply
  if (authStatus === null) {
    return (
      <div className="text-center mt-20 text-xl font-bold text-slate-500">
        Verifying Security Credentials...
      </div>
    );
  }

  // 2. Cookie is missing, fake, or expired
  if (!authStatus.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // 3. Cookie is real, but they don't have the right clearance level
  if (allowedRole) {
    const allowedRoles = Array.isArray(allowedRole)
      ? allowedRole
      : [allowedRole];
    // Legacy support: if USER is allowed, also allow old DRIVER and PASSENGER roles
    if (allowedRole === "USER") {
      allowedRoles.push("DRIVER", "PASSENGER");
    }
    if (!allowedRoles.includes(authStatus.role)) {
      alert("Security: Unauthorized access blocked.");
      return <Navigate to="/" replace />;
    }
  }

  // 4. Checking if user is verified by admin
  if (authStatus.role !== "ADMIN" && authStatus.isVerified === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] mt-10">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md border border-slate-100">
          <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Pending Verification
          </h2>
          <p className="text-slate-600 mb-6 font-medium leading-relaxed">
            Your College ID and Selfie are currently under review by our
            administrators.
          </p>
          <p className="text-sm text-slate-500">
            Full access to booking and offering rides will be unlocked shortly.
            Please check back later.
          </p>
        </div>
      </div>
    );
  }

  // 5. Fully authorized!
  return children;
};

export default ProtectedRoute;
