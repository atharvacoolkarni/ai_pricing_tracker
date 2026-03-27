import { Suspense } from "react";
import { getSubscriptions } from "@/lib/data";
import SubscriptionsPageClient from "./SubscriptionsPageClient";

function SubscriptionsContent() {
  const { providers } = getSubscriptions();
  return <SubscriptionsPageClient providers={providers} />;
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 dark:text-gray-400">Loading...</div>}>
      <SubscriptionsContent />
    </Suspense>
  );
}
