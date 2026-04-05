import { CONFIG } from "./config";
import { mockApi } from "../mocks/mock-api";
import type {
  Member,
  Event,
  Excuse,
  Fine,
  CheckinLink,
  FineSummary,
  InviteResult,
  RosterEntry,
  DelinquencyScore,
  MemberDelinquencyDetail,
  SecurityAssignment,
  ReminderResponse,
} from "./types";

class ApiClient {
  private token: string | null = null;

  setToken(t: string | null) {
    this.token = t;
  }

  async request<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = CONFIG.USE_MOCKS
      ? await mockApi.fetch(path, { ...opts, headers })
      : await fetch(`${CONFIG.API_BASE}${path}`, { ...opts, headers });

    const data = await res.json();
    if (!res.ok) throw new Error((data as { detail?: string }).detail || "Request failed");
    return data as T;
  }

  // Auth
  getMe() {
    return this.request<Member>("/api/auth/me");
  }
  invite(emails: string[]) {
    return this.request<InviteResult>("/api/auth/invite", {
      method: "POST",
      body: JSON.stringify({ emails }),
    });
  }

  // Events
  getEvents() {
    return this.request<Event[]>("/api/events");
  }
  getEvent(id: string) {
    return this.request<Event>(`/api/events/${id}`);
  }
  createEvent(data: Partial<Event>) {
    return this.request<Event>("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  deleteEvent(id: string) {
    return this.request<{ deleted: boolean }>(`/api/events/${id}`, { method: "DELETE" });
  }

  // Check-in links
  createCheckinLink(eventId: string) {
    return this.request<CheckinLink>(`/api/events/${eventId}/checkin-link`, { method: "POST" });
  }
  killCheckinLink(eventId: string) {
    return this.request<{ deactivated: boolean }>(`/api/events/${eventId}/checkin-link`, { method: "DELETE" });
  }

  // Attendance
  checkinViaLink(code: string) {
    return this.request<{ status: string; event_title: string }>(`/api/attendance/checkin/${code}`, { method: "POST" });
  }
  getAttendance(eventId: string) {
    return this.request<RosterEntry[]>(`/api/attendance/event/${eventId}`);
  }
  manualCheckin(eventId: string, memberId: string) {
    return this.request<{ status: string; method: string }>(
      `/api/attendance/event/${eventId}/manual/${memberId}`,
      { method: "POST" },
    );
  }

  // Excuses
  submitExcuse(eventId: string, reason: string) {
    return this.request<Excuse>(`/api/excuses/event/${eventId}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }
  getExcuses(status?: string | null) {
    return this.request<Excuse[]>(`/api/excuses${status ? `?status=${status}` : ""}`);
  }
  reviewExcuse(id: string, status: string) {
    return this.request<Excuse>(`/api/excuses/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  // Fines
  getFines(status?: string | null) {
    return this.request<Fine[]>(`/api/fines${status ? `?status=${status}` : ""}`);
  }
  payFine(id: string) {
    return this.request<Fine>(`/api/fines/${id}/pay`, { method: "POST" });
  }
  waiveFine(id: string) {
    return this.request<Fine>(`/api/fines/${id}/waive`, { method: "POST" });
  }
  getFineSummary() {
    return this.request<FineSummary>("/api/fines/summary");
  }

  // Members
  getMembers() {
    return this.request<Member[]>("/api/members");
  }

  // Delinquency
  getDelinquencyScores() {
    return this.request<DelinquencyScore[]>("/api/delinquency/scores");
  }
  getMemberDelinquency(memberId: string) {
    return this.request<MemberDelinquencyDetail>(`/api/delinquency/member/${memberId}`);
  }
  assignSecurity() {
    return this.request<SecurityAssignment>("/api/delinquency/assign-security", { method: "POST" });
  }
  sendReminder(memberId: string) {
    return this.request<ReminderResponse>(`/api/delinquency/remind/${memberId}`, { method: "POST" });
  }
}

export const api = new ApiClient();
