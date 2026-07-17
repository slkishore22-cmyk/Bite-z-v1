import { Navigate } from "react-router-dom";
import { getAdminSession } from "@/utils/sessionManager";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const s = getAdminSession();
  if (!s) return <Navigate to="/master-admin/login" replace />;
  return <>{children}</>;
}