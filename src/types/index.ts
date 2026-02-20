// ProConnect — Shared TypeScript Types

// ─── Auth User (serialized from Logto context) ──────────

export interface AuthUser {
  sub: string;
  name: string;
  email: string;
  avatar?: string;
  role: "ADMIN" | "EMPLOYEE";
}

// ─── User ─────────────────────────────────────────────────

export interface User {
  id: string;
  logtoId: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "EMPLOYEE";
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Kudos ────────────────────────────────────────────────

export interface KudosMessage {
  id: string;
  content: string;
  authorId: string;
  recipientId: string;
  author: Pick<User, "id" | "displayName" | "avatarUrl"> & { photoUrl?: string };
  recipient: Pick<User, "id" | "displayName" | "avatarUrl"> & { photoUrl?: string };
  likes: number;
  createdAt: string;
}

// ─── Alerts ───────────────────────────────────────────────

export type AlertType = "INFO" | "WARNING" | "BIRTHDAY" | "NEW_HIRE" | "ANNOUNCEMENT";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Alert {
  id: string;
  title: string;
  content: string;
  type: AlertType;
  priority: Priority;
  active: boolean;
  createdBy: string;
  author: Pick<User, "id" | "displayName">;
  createdAt: string;
  updatedAt: string;
}

// ─── Directory (Graph API) ────────────────────────────────

export interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  userPrincipalName: string;
  manager?: DirectoryUser | null;
  directReports?: DirectoryUser[];
}

// ─── OOO Status ───────────────────────────────────────────

export interface OofStatus {
  status: "disabled" | "alwaysEnabled" | "scheduled";
  externalAudience: "none" | "contactsOnly" | "all";
  scheduledStartDateTime: string | null;
  scheduledEndDateTime: string | null;
  internalReplyMessage: string | null;
  externalReplyMessage: string | null;
}

// ─── Calendar (from proxy) ────────────────────────────────

export interface Holiday {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  category: "federal" | "fun" | "company";
  color: string;
  source: string;
  visible: boolean;
  recurring: boolean;
}

// ─── Stats ────────────────────────────────────────────────

export interface DashboardStats {
  upcomingHolidays: number;
  teamMembers: number;
  activeAlerts: number;
  kudosThisMonth: number;
}
