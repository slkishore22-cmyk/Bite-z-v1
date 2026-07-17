// Update this page (the content is just a fallback if you fail to update the page)

// IMPORTANT: Fully REPLACE this with your own code
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
          <span className="material-symbols-outlined text-primary-foreground" style={{ fontSize: 28 }}>shield_lock</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Bitez</h1>
        <p className="text-muted-foreground">Choose an app to continue.</p>
        <div className="grid gap-3">
          <Link to="/seller" className="rounded-2xl bg-gradient-primary px-5 py-4 font-semibold text-primary-foreground shadow-glow">
            Seller Dashboard
          </Link>
          <Link to="/home" className="rounded-2xl border border-border bg-secondary px-5 py-4 font-semibold text-foreground">
            User App
          </Link>
        </div>
      </div>
    </main>
  );
};

export default Index;
