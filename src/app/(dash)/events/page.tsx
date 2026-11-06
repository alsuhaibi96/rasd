import { Suspense } from "react";
import { EventsView } from "@/components/views/events";

export default function Page() {
  return (
    <Suspense>
      <EventsView />
    </Suspense>
  );
}
