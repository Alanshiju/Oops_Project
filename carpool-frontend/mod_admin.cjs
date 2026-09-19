const fs = require("fs");
let content = fs.readFileSync("src/pages/AdminDashboard.jsx", "utf8");

const stateAdditions = `
  const [socialLinks, setSocialLinks] = useState({ whatsapp: "", facebook: "", instagram: "" });
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
            alert("✅ " + data.message);
        } else {
            alert("❌ " + (data.error || "Failed to update social links"));
        }
      })
      .catch((err) => {
        setIsUpdatingSocial(false);
        alert("Error contacting server: " + err.message);
      });
  };
`;

content = content.replace(
  "const [campusDestination, setCampusDestination] = useState(null);",
  stateAdditions +
    "\n  const [campusDestination, setCampusDestination] = useState(null);",
);

const socialForm = `
          {/* Social Media Links CMS */}
          <div className="mt-8 bg-white p-8 rounded-xl shadow-md border border-slate-200 text-left">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Social Media Links</h2>
            <p className="text-slate-500 mb-6">Update the links shown in the global website footer.</p>
            
            <form onSubmit={handleUpdateSocialLinks} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Group/Chat URL</label>
                <input
                  type="url"
                  value={socialLinks.whatsapp || ''}
                  onChange={(e) => setSocialLinks({ ...socialLinks, whatsapp: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Facebook Page URL</label>
                <input
                  type="url"
                  value={socialLinks.facebook || ''}
                  onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Instagram Profile URL</label>
                <input
                  type="url"
                  value={socialLinks.instagram || ''}
                  onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://instagram.com/..."
                />
              </div>
              <button
                type="submit"
                disabled={isUpdatingSocial}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-slate-400"
              >
                {isUpdatingSocial ? "Saving..." : "Save Social Links"}
              </button>
            </form>
          </div>
`;

content = content.replace(
  "</button>\n          </div>",
  "</button>\n          </div>\n" + socialForm,
);
fs.writeFileSync("src/pages/AdminDashboard.jsx", content);
