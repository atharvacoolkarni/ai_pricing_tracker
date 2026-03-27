import { getSubscriptions } from "@/lib/data";
import ComparePageClient from "./ComparePageClient";

export default function ComparePage() {
  const { providers } = getSubscriptions();
  return <ComparePageClient providers={providers} />;
}
