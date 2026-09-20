import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = () => {
    fetch(`${API_BASE_URL}/api/user/profile`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        navigate("/login");
      });
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    setIsSavingProfile(true);

    fetch(`${API_BASE_URL}/api/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, phone }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          fetchProfile();
        } else {
          alert("❌ " + data.error);
        }
      })
      .finally(() => setIsSavingProfile(false));
  };

  const handleChangePassword = (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert("❌ New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      alert("❌ New password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);

    fetch(`${API_BASE_URL}/api/user/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentPassword, newPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          alert("✅ " + data.message);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } else {
          alert("❌ " + data.error);
        }
      })
      .finally(() => setIsChangingPassword(false));
  };

  if (loading) {
    return (
      <div className="text-center mt-20 text-xl font-bold text-slate-500">
        Loading Profile...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center mt-10 w-full max-w-3xl mx-auto px-4 pb-10">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full border border-slate-200 mb-8">
        <h2 className="text-3xl font-extrabold text-blue-900 mb-6 flex justify-between items-center">
          My Profile
          <span
            className={`text-sm px-4 py-1.5 rounded-full font-bold shadow-sm ${
              profile.is_verified
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {profile.is_verified ? "✅ Verified" : "⏳ Pending Verification"}
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Role
            </p>
            <p className="font-semibold text-slate-800 text-lg">
              {profile.role}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              College Email
            </p>
            <p className="font-semibold text-blue-700">{profile.email}</p>
          </div>
          {profile.college_id_url && (
            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                College ID Document
              </p>
              <img
                src={`${API_BASE_URL}${profile.college_id_url}`}
                alt="College ID"
                className="h-32 rounded border shadow-sm object-cover"
              />
            </div>
          )}
        </div>

        <form onSubmit={handleUpdateProfile} className="mb-10">
          <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">
            Personal Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="+91..."
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSavingProfile}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-md ${
              isSavingProfile
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:scale-95"
            }`}
          >
            {isSavingProfile ? "Saving..." : "Update Profile"}
          </button>
        </form>

        <form onSubmit={handleChangePassword}>
          <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">
            Change Password
          </h3>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:outline-none"
                  minLength="6"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:outline-none"
                  minLength="6"
                  required
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isChangingPassword}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-md ${
              isChangingPassword
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-slate-800 hover:bg-slate-900 active:scale-95"
            }`}
          >
            {isChangingPassword ? "Updating..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
