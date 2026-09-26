import { SensorDetailView } from "@/components/views/sensor-detail";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <SensorDetailView code={decodeURIComponent((await params).code)} />;
}
