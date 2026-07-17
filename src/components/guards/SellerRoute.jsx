import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { db, auth } from '@/integrations/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { getSellerSession } from '../../utils/sessionManager';
import { clearSellerScopedCaches } from '../../lib/sellerCaches';

export default function SellerRoute({ children }) {
  const session = getSellerSession();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let alive = true;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!alive) return;
      setCurrentUser(user);
      
      if (!session?.id || !user) {
        setValid(false);
        setLoading(false);
        return;
      }

      const docRef = doc(db, 'sellers', session.id);
      getDoc(docRef).then((docSnap) => {
        if (!alive) return;
        const data = docSnap.exists() ? docSnap.data() : null;
        const ok = Boolean(data && data.is_active !== false && !data.is_suspended);
        if (!ok) {
          localStorage.removeItem('bitez_seller_session');
          localStorage.removeItem('bitez.seller.session.v1');
          clearSellerScopedCaches();
          auth.signOut().catch(() => null);
        }
        setValid(ok);
        setLoading(false);
      }).catch(() => {
        if (!alive) return;
        setValid(true);
        setLoading(false);
      });
    });

    return () => {
      alive = false;
      unsubAuth();
    };
  }, [session?.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
        <div style={{ color: '#71717a', fontSize: 14 }}>Initializing session...</div>
      </div>
    );
  }

  if (!session || !currentUser || !valid) return <Navigate to="/seller/login" replace />;
  return children;
}