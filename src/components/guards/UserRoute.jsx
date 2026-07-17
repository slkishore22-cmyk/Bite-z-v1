import { Navigate } from 'react-router-dom';
import { getUserSession } from '../../utils/sessionManager';
import { auth } from '../../integrations/firebase/client';

export default function UserRoute({ children }) {
  const session = getUserSession();
  const currentUser = auth.currentUser;
  
  if (!session || !currentUser) {
    return <Navigate to="/app/login" replace />;
  }
  return children;
}
