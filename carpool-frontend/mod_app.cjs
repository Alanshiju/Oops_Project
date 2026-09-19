const fs = require("fs");
let content = fs.readFileSync("src/App.jsx", "utf8");

// Hide top nav on mobile
content = content.replace(
  '<nav className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-50">',
  '<nav className="hidden md:block bg-blue-900 text-white p-4 shadow-md sticky top-0 z-50">',
);

// Create BottomNavigation
const bottomNav = `
const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(null);

  useEffect(() => {
    fetch("http://localhost:7070/api/check-auth", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { isAuthenticated: false }))
      .then((data) => {
        if (data && data.isAuthenticated) setRole(data.role);
        else setRole(null);
      })
      .catch(() => setRole(null));
  }, [location.pathname]);

  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 md:hidden z-[9999]">
      <Link to="/" className={\`flex flex-col items-center \${location.pathname === '/' ? 'text-blue-600' : 'text-gray-500'}\`}>
        <span className="text-xl">🏠</span>
        <span className="text-xs font-semibold">Home</span>
      </Link>
      {role && (role === "USER" || role === "DRIVER" || role === "PASSENGER") && (
        <>
          <Link to="/student" className={\`flex flex-col items-center \${location.pathname === '/student' ? 'text-blue-600' : 'text-gray-500'}\`}>
            <span className="text-xl">🔍</span>
            <span className="text-xs font-semibold">Find Ride</span>
          </Link>
          <Link to="/driver" className={\`flex flex-col items-center \${location.pathname === '/driver' ? 'text-blue-600' : 'text-gray-500'}\`}>
            <span className="text-xl">🚗</span>
            <span className="text-xs font-semibold">Drive</span>
          </Link>
          <Link to="/profile" className={\`flex flex-col items-center \${location.pathname === '/profile' ? 'text-blue-600' : 'text-gray-500'}\`}>
            <span className="text-xl">👤</span>
            <span className="text-xs font-semibold">Profile</span>
          </Link>
        </>
      )}
      {!role && (
        <Link to="/login" className={\`flex flex-col items-center \${location.pathname === '/login' ? 'text-blue-600' : 'text-gray-500'}\`}>
          <span className="text-xl">🔑</span>
          <span className="text-xs font-semibold">Sign In</span>
        </Link>
      )}
    </div>
  );
};
`;

content = content.replace("function App() {", bottomNav + "\nfunction App() {");
content = content.replace(
  '<div className="flex-grow w-full">',
  '<Toaster position="top-center" reverseOrder={false} />\n        <div className="flex-grow w-full pb-16 md:pb-0">',
);
content = content.replace(
  "</Routes>",
  "</Routes>\n          <BottomNavigation />",
);

fs.writeFileSync("src/App.jsx", content);
