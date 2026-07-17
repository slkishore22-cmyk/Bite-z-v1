import { useEffect } from "react";
import { applyPwaHeadForPath } from "@/lib/pwaLaunch";

/**
 * Swap the document's <link rel="manifest"> to the admin manifest while a
 * Master Admin page is mounted. Restores the original (user) manifest on
 * unmount so installs from the user app keep their identity.
 */
export function useAdminPwa() {
  useEffect(() => {
    applyPwaHeadForPath("/master-admin/overview");
  }, []);
}