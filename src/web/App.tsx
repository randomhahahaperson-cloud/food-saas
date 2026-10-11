import { useEffect, useState } from "react";
import { healthResponseSchema } from "@/shared/health";

type Status = "loading" | "ready" | "error";

export function App() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setStatus(healthResponseSchema.parse(data).ok ? "ready" : "error");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 text-center">
      {status === "loading" && <p className="text-lg">Getting things ready…</p>}
      {status === "ready" && <p className="text-lg">All set. The app is running.</p>}
      {status === "error" && (
        <p className="text-lg">We couldn't reach the app right now. Please refresh in a moment.</p>
      )}
    </main>
  );
}
