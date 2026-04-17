// ProConnect — Shared TypeScript Types

// ─── Auth User (serialized from Logto context) ──────────

export interface AuthUser {
  sub: string;
  name: string;
  email: string;
  avatar?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE";
  permissions: string[];
  logtoRoles: string[]; // raw Logto role names (e.g. "loan_officer", "director", "avp")
}

// ─── User ─────────────────────────────────────────────────

export interface User {
  id: string;
  logtoId: string;
  email: string;
  displayName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE";
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Props ────────────────────────────────────────────────

export interface PropsMessage {
  id: string;
  content: string;
  authorId: string;
  recipientId: string;
  author: Pick<User, "id" | "displayName" | "email" | "avatarUrl"> & { photoUrl?: string };
  recipient: Pick<User, "id" | "displayName" | "email" | "avatarUrl"> & { photoUrl?: string };
  likes: number;
  badge?: string;
  reactions?: {
    highfive: number;
    uplift: number;
    bomb: number;
  };
  myReactions?: Array<"highfive" | "uplift" | "bomb">;
  commentCount?: number;
  createdAt: string;
}

export interface PropsComment {
  id: string;
  propsId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId: string | null;
  likes: number;
  userLiked?: boolean;
  canDelete?: boolean;
  createdAt: string;
  replies?: PropsComment[];
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

// ─── Ideas ────────────────────────────────────────────────

export type IdeaStatus = "ACTIVE" | "SELECTED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";

export interface Idea {
  id: string;
  title: string;
  description: string;
  userId: string;
  authorName: string;
  authorEmail?: string | null;
  votes: number;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
}

export interface IdeaComment {
  id: string;
  ideaId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId: string | null;
  likes: number;
  userLiked?: boolean;
  canDelete?: boolean;
  createdAt: string;
  replies?: IdeaComment[];
}

// ─── Video Spotlight Comments/Reactions ───────────────────

export interface VideoSpotlightComment {
  id: string;
  videoId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId: string | null;
  likes: number;
  userLiked?: boolean;
  createdAt: string;
  replies?: VideoSpotlightComment[];
}

export interface VideoReactions {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
}

// ─── Important Dates ──────────────────────────────────────

export interface ImportantDate {
  id: string;
  label: string;
  subtitle?: string | null;
  date: string;
  recurType: string; // "none" | "monthly" | "first_workday"
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── MyShare (Social Feed) ─────────────────────────────

export interface MyShareMedia {
  id: string;
  fileUrl: string;
  mimeType: string;
  sortOrder: number;
}

export interface MySharePost {
  id: string;
  authorId: string;
  authorEmail?: string;
  authorName: string;
  authorPhotoUrl?: string;
  caption: string | null;
  media: MyShareMedia[];
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
  previewComments?: { id: string; authorName: string; authorEmail?: string; content: string }[];
  createdAt: string;
}

export interface MyShareComment {
  id: string;
  postId: string;
  authorId: string;
  authorEmail?: string;
  authorName: string;
  authorPhotoUrl?: string;
  content: string;
  parentId: string | null;
  likes: number;
  userLiked: boolean;
  canDelete: boolean;
  createdAt: string;
  replies?: MyShareComment[];
}

// ─── Stats ────────────────────────────────────────────────

export interface DashboardStats {
  upcomingHolidays: number;
  teamMembers: number;
  activeAlerts: number;
  propsThisMonth: number;
}

// ─── Unified Comment (shared across all widgets) ──────────

export interface UnifiedComment {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  parentId: string | null;
  likes: number;
  userLiked: boolean;
  canDelete: boolean;
  createdAt: string;
  replies?: UnifiedComment[];
}

// ─── Hashtag ──────────────────────────────────────────────

export interface HashtagResult {
  tag: string;
  count: number;
}

// ─── Tournament Bracket ───────────────────────────────────

export type TournamentStatus = "SETUP" | "IN_PROGRESS" | "COMPLETED";
export type MatchStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type Division = "Region 1" | "Region 2" | "Region 3" | "Region 4";

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
  teams?: TournamentTeam[];
  matches?: TournamentMatch[];
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  player1Name: string;
  player2Name: string;
  seed: number;
  division: string;
  createdAt: string;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  division: string;
  team1Id: string | null;
  team1: TournamentTeam | null;
  team2Id: string | null;
  team2: TournamentTeam | null;
  winnerId: string | null;
  winner: TournamentTeam | null;
  team1Score: number | null;
  team2Score: number | null;
  status: MatchStatus;
  nextMatchId: string | null;
  createdAt: string;
  updatedAt: string;
}
