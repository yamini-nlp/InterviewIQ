"use client";
import { useEffect, useState } from "react";
import { getSessions } from "@/lib/api";
import { Session } from "@/types";
import { SessionCard } from "@/components/dashboard/SessionCard";
import { Button } from "@/components/ui/Button";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions()
      .then((d) => { setSessions(d.sessions); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-night-950">
      <main className="pt-24 pb-16 px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-400 mt-1">Your interview history and performance</p>
          </div>
          <Link href="/setup"><Button><Plus size={14} /> New Interview</Button></Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">No sessions yet. Start your first interview!</p>
            <Link href="/setup"><Button>Start Practicing</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </main>
    </div>
  );
}