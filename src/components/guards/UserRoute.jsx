import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getUserSession } from '../../utils/sessionManager';
import { auth } from '../../integrations/firebase/client';
import OrbitLoader from '../OrbitLoader';

export default function UserRoute({ children }) {
  const session = getUserSession();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    let alive = true;
    const unsub = auth.onAuthStateChanged((user) => {
      if (!alive) return;
      setCurrentUser(user);
      setLoading(false);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(var(--background))',
        }}
      >
        <OrbitLoader size={60} />
      </div>
    );
  }

  if (!session || !currentUser) {
    return <Navigate to="/app/login" replace />;
  }
  return children;
}
