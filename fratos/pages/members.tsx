"use client";
import { useApi } from "../hooks/use-api";
import { api } from "../lib/api-client";
import { T } from "../lib/theme";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar } from "../components/ui/avatar";
import type { Member } from "../lib/types";

export function MembersPage() {
  const members = useApi<Member[]>(() => api.getMembers());

  return (
    <div>
      <Card>
        <h3 style={{ margin: "0 0 14px", color: T.tx, fontSize: 16 }}>Chapter Roster</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {(members.data || []).map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: T.bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={m.name} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.tx }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: T.txm }}>{m.email}</div>
                </div>
              </div>
              <Badge color={m.role === "officer" ? "purple" : "gray"}>{m.role}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
