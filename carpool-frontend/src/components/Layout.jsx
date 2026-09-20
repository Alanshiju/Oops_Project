import Navbar from "./Navbar";
import Footer from "./Footer";

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar />
      <main className="flex-grow w-full">{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
