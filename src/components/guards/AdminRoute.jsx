import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAdminSession, clearAdminSession } from '../../utils/sessionManager';
import { auth, db } from '../../integrations/firebase/client';
import { doc, getDoc } from 'firebase/firestore';

export default function AdminRoute({ children }) {
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let alive = true;
    const unsub = auth.onAuthStateChanged((user) => {
      if (!alive) return;
      setCurrentUser(user);

      if (!session || !user) {
        setValid(false);
        setLoading(false);
        return;
      }

      // Check if admin is approved in Firestore
      const docRef = doc(db, 'admins', user.uid);
      getDoc(docRef)
        .then((docSnap) => {
          if (!alive) return;
          const data = docSnap.exists() ? docSnap.data() : null;
          const ok = Boolean(data && data.is_approved === true);
          if (!ok) {
            clearAdminSession();
            auth.signOut().catch(() => null);
          }
          setValid(ok);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          // In case of error (e.g. offline/permission issues), fallback to security denial
          setValid(false);
          setLoading(false);
        });
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [session?.username]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#111118' }}>
        <div style={{ color: '#6B7280', fontSize: 14 }}>Initializing session...</div>
      </div>
    );
  }

  if (!session || !currentUser || !valid) {
    return <Navigate to="/master-admin/login" replace />;
  }
  return children;
}
