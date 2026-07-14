import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Applicants from "./pages/Applicants";
import Evaluate from "./pages/Evaluate";
import Summary from "./pages/Summary";

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-mono text-sm font-bold text-gold-600">404</p>
      <h1 className="font-display text-2xl font-bold text-nu-900">Page not found</h1>
      <p className="text-sm text-ink/50">The page you're looking for doesn't exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-paper">
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/applicants"
              element={
                <ProtectedRoute>
                  <Applicants />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluate/:id"
              element={
                <ProtectedRoute>
                  <Evaluate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/summary"
              element={
                <ProtectedRoute>
                  <Summary />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
