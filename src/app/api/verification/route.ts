import { handler } from "@/lib/api";
import { runVerification } from "@/lib/verification";

export const dynamic = "force-dynamic";

export const GET = handler(async () => runVerification());
