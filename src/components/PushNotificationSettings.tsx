import { useState } from "react";
import { getSellerSession } from "@/lib/sellerAuth";
import { Bell, BellOff, Smartphone, AlertCircle, Send } from "lucide-react";
import OrbitLoader from "@/components/OrbitLoader";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";


export function PushNotificationSettings() {
  const { toast } = useToast();
  const { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, unsubscribe } =
    usePushNotifications();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast({ title: "Notifications disabled" });
      } else {
        await subscribe();
        toast({ title: "Notifications enabled" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const seller = getSellerSession();
      if (!seller?.id) throw new Error("Not authenticated");
      
      console.log("Simulating push notification send for user/seller:", seller.id);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({ title: "Test notification simulated" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isiOS && !isPWA) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Push Notifications</h3>
        </div>
        <p className="text-sm text-muted-foreground">Install the app first to enable notifications:</p>
        <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
          <li>Tap the Share button in Safari</li>
          <li>Scroll down and tap "Add to Home Screen"</li>
          <li>Open the app from your home screen</li>
        </ol>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">Push Notifications</h3>
          <p className="text-sm text-muted-foreground">Not supported in this browser</p>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <div>
          <h3 className="font-semibold">Push Notifications</h3>
          <p className="text-sm text-muted-foreground">Permission denied — update browser settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSubscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          <div>
            <h3 className="font-semibold">Push Notifications</h3>
            <p className="text-sm text-muted-foreground">{isSubscribed ? "Enabled" : "Disabled"}</p>
          </div>
        </div>
        <Switch checked={isSubscribed} onCheckedChange={handleToggle} disabled={isLoading} />
      </div>
      {isSubscribed && (
        <Button variant="outline" size="sm" onClick={handleSendTest} disabled={isSendingTest} className="w-full">
          {isSendingTest ? <span className="mr-2 inline-flex"><OrbitLoader size={16} /></span> : <Send className="h-4 w-4 mr-2" />}
          Send Test
        </Button>
      )}
    </div>
  );
}