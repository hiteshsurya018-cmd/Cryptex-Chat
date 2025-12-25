import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/cryptex/Header";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
    document.documentElement.classList.add("dark");
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex justify-center items-center p-4">
      <div className="max-w-lg w-full h-[90vh] bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-gray-800">404</h1>
            <p className="text-lg text-gray-600 mt-2">Page not found</p>
            <a
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
