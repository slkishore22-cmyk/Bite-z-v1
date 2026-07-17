import { Navigate } from "react-router-dom";
import { getSellerSession } from "@/utils/sessionManager";

const SellerProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const session = getSellerSession();
  if (!session) return <Navigate to="/seller/login" replace />;
  return <>{children}</>;
};

export default SellerProtectedRoute;