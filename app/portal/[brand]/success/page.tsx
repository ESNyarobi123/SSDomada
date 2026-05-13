import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PortalSuccessClient from "./success-client";

export default function PortalSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-onyx-950 via-onyx-900 to-onyx-950">
          <Loader2 className="w-6 h-6 text-gold animate-spin" />
        </div>
      }
    >
      <PortalSuccessClient />
    </Suspense>
  );
}
