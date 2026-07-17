import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { UploadProvider } from "./context/UploadContext";
import Login from "./components/Login";
import DrivePage from "./pages/DrivePage";
import SharePage from "./pages/SharePage";
import { Loader2 } from "lucide-react";

function DriveGate() {
  const { loading, authenticated } = useAuth();
  const { push } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!authenticated) return <Login />;

  return (
    <UploadProvider onUploaded={() => push("上传任务已完成", "success")}>
      <DrivePage />
    </UploadProvider>
  );
}

function MainApp() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DriveGate />
      </AuthProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/s/:id" element={<SharePage />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
