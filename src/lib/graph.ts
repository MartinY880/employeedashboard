// ProConnect — Microsoft Graph API Utility
// Server-side Graph client for directory + OOO functionality
// Uses client credentials flow for app-level access

import "server-only";

// ─── Config ───────────────────────────────────────────────

export const graphConfig = {
  tenantId: process.env.AZURE_TENANT_ID || "",
  clientId: process.env.AZURE_CLIENT_ID || "",
  clientSecret: process.env.AZURE_CLIENT_SECRET || "",
  scopes: ["https://graph.microsoft.com/.default"],
};

export const isGraphConfigured =
  !!graphConfig.tenantId &&
  !!graphConfig.clientId &&
  !!graphConfig.clientSecret;

const DIRECTORY_CACHE_TTL_MS = Number(process.env.DIRECTORY_CACHE_TTL_MS || 300000); // 5 min

type CacheState<T> = {
  value: T | null;
  expiresAt: number;
  inFlight: Promise<T> | null;
};

const allUsersCache: CacheState<GraphUser[]> = {
  value: null,
  expiresAt: 0,
  inFlight: null,
};

const orgHierarchyCache: CacheState<GraphUser[]> = {
  value: null,
  expiresAt: 0,
  inFlight: null,
};

function cloneDirectoryData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Graph Client Singleton ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _graphClient: any = null;

async function getGraphClient() {
  if (_graphClient) return _graphClient;

  if (!isGraphConfigured) {
    throw new Error("Microsoft Graph API is not configured");
  }

  const { Client } = await import("@microsoft/microsoft-graph-client");
  const { TokenCredentialAuthenticationProvider } = await import(
    "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials"
  );
  const { ClientSecretCredential } = await import("@azure/identity");

  const credential = new ClientSecretCredential(
    graphConfig.tenantId,
    graphConfig.clientId,
    graphConfig.clientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: graphConfig.scopes,
  });

  _graphClient = Client.initWithMiddleware({
    authProvider,
    debugLogging: process.env.NODE_ENV === "development",
  });

  return _graphClient;
}

// ─── User select fields ──────────────────────────────────

const USER_SELECT = [
  "id",
  "displayName",
  "mail",
  "userPrincipalName",
  "jobTitle",
  "employeeType",
  "department",
  "officeLocation",
  "businessPhones",
  "mobilePhone",
  "accountEnabled",
  "assignedLicenses",
].join(",");

// ─── Directory Functions ──────────────────────────────────

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  employeeType?: string | null;
  department: string | null;
  officeLocation: string | null;
  businessPhone?: string | null;
  mobilePhone?: string | null;
  faxNumber?: string | null;
  accountEnabled?: boolean;
  assignedLicenses?: Array<{ skuId: string }>;
  directReports?: GraphUser[];
  manager?: GraphUser | null;
}

type GraphUserWithRawPhones = GraphUser & {
  businessPhones?: string[];
};

function normalizePhone(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGraphUser(user: GraphUserWithRawPhones): GraphUser {
  const normalizedBusinessPhones = (user.businessPhones ?? [])
    .map((phone) => phone.trim())
    .filter((phone) => phone.length > 0);

  const businessPhone = normalizedBusinessPhones[0] ?? null;
  const faxNumber = normalizedBusinessPhones[1] ?? null;

  return {
    ...user,
    businessPhone,
    mobilePhone: normalizePhone(user.mobilePhone),
    faxNumber,
  };
}

/**
 * Fetch all users from Graph (uncached)
 */
async function fetchAllUsersFromGraph(): Promise<GraphUser[]> {
  const client = await getGraphClient();

  const result = await client
    .api("/users")
    .select(USER_SELECT)
    .top(999)
    .filter("accountEnabled eq true")
    .get();

  const users: GraphUser[] = ((result.value || []) as GraphUserWithRawPhones[]).map(
    normalizeGraphUser
  );

  // Directory should only include active + licensed employees
  return users.filter((user) => {
    const isActive = user.accountEnabled !== false;
    const hasLicense = (user.assignedLicenses?.length ?? 0) > 0;
    const hasDepartment =
      typeof user.department === "string" && user.department.trim().length > 0;
    const hasEmployeeType =
      typeof user.employeeType === "string" && user.employeeType.trim().length > 0;
    return isActive && hasLicense && (hasDepartment || hasEmployeeType);
  });
}

/**
 * Get all users from the directory (cached)
 */
export async function getAllUsers(): Promise<GraphUser[]> {
  const now = Date.now();
  if (allUsersCache.value && allUsersCache.expiresAt > now) {
    return cloneDirectoryData(allUsersCache.value);
  }

  if (!allUsersCache.inFlight) {
    allUsersCache.inFlight = (async () => {
      const users = await fetchAllUsersFromGraph();
      allUsersCache.value = users;
      allUsersCache.expiresAt = Date.now() + DIRECTORY_CACHE_TTL_MS;
      return users;
    })().finally(() => {
      allUsersCache.inFlight = null;
    });
  }

  const users = await allUsersCache.inFlight;
  return cloneDirectoryData(users);
}

/**
 * Get a user's direct reports recursively (builds org tree)
 */
export async function getUserWithReports(userId: string): Promise<GraphUser> {
  const client = await getGraphClient();

  // Get user details
  const userResponse = await client
    .api(`/users/${userId}`)
    .select(USER_SELECT)
    .get();
  const user: GraphUser = normalizeGraphUser(userResponse as GraphUserWithRawPhones);

  // Get direct reports
  const reportsResult = await client
    .api(`/users/${userId}/directReports`)
    .select(USER_SELECT)
    .get();

  const directReports = ((reportsResult.value || []) as GraphUserWithRawPhones[]).map(
    normalizeGraphUser
  );

  // Recursively get reports for each direct report (limit depth)
  user.directReports = await Promise.all(
    directReports.map((report: GraphUser) => getUserWithReports(report.id))
  );

  return user;
}

/**
 * Build org hierarchy starting from users with no manager (CEO level)
 */
export async function getOrgHierarchy(): Promise<GraphUser[]> {
  const now = Date.now();
  if (orgHierarchyCache.value && orgHierarchyCache.expiresAt > now) {
    return cloneDirectoryData(orgHierarchyCache.value);
  }

  if (orgHierarchyCache.inFlight) {
    const cachedInFlight = await orgHierarchyCache.inFlight;
    return cloneDirectoryData(cachedInFlight);
  }

  orgHierarchyCache.inFlight = (async () => {
  const client = await getGraphClient();
  const startedAt = Date.now();

  // Build hierarchy from manager relationships in Entra
  const allUsers = await getAllUsers();
  console.log("[Graph] Building hierarchy", { userCount: allUsers.length });
  const userMap = new Map<string, GraphUser>();

  for (const user of allUsers) {
    userMap.set(user.id, { ...user, directReports: [] });
  }

  // ── Phase 1: Batch-resolve manager relationships ──
  const managerResults: Array<{ userId: string; managerId: string | null }> = [];
  const batchSize = 20;

  for (let i = 0; i < allUsers.length; i += batchSize) {
    const chunk = allUsers.slice(i, i + batchSize);
    const requests = chunk.map((user) => ({
      id: user.id,
      method: "GET",
      url: `/users/${user.id}/manager?$select=id`,
    }));

    try {
      const batchResponse = await client.api("/$batch").post({ requests });
      const responses = (batchResponse?.responses || []) as Array<{ id: string; status: number; body?: { id?: string } }>;

      const byId = new Map<string, { status: number; body?: { id?: string } }>();
      for (const response of responses) {
        byId.set(response.id, response);
      }

      for (const user of chunk) {
        const response = byId.get(user.id);
        if (response && response.status === 200) {
          managerResults.push({ userId: user.id, managerId: response.body?.id ?? null });
        } else {
          managerResults.push({ userId: user.id, managerId: null });
        }
      }
    } catch {
      for (const user of chunk) {
        managerResults.push({ userId: user.id, managerId: null });
      }
    }
  }

  const roots: GraphUser[] = [];
  // Track users whose manager exists in Entra but is NOT in our filtered list
  const orphanedUsers: Array<{ user: GraphUser; managerId: string }> = [];

  for (const result of managerResults) {
    const current = userMap.get(result.userId);
    if (!current) continue;

    if (result.managerId && userMap.has(result.managerId)) {
      // Manager is in our filtered user list — normal case
      const managerNode = userMap.get(result.managerId);
      managerNode?.directReports?.push(current);
    } else if (result.managerId) {
      // Manager exists in Entra but was filtered out (no dept/license/disabled).
      // We'll walk up the chain in Phase 2 to find an ancestor in the list.
      orphanedUsers.push({ user: current, managerId: result.managerId });
    } else {
      // Genuinely no manager — true root
      roots.push(current);
    }
  }

  // ── Phase 2: Walk up the chain for orphaned users ──
  // When a user's direct manager is filtered out, we trace up the hierarchy
  // via /users/{id}/manager calls until we find an ancestor in our user list.
  if (orphanedUsers.length > 0) {
    console.log("[Graph] Phase 2: Walking up chain for", orphanedUsers.length, "users with filtered-out managers");

    for (const { user, managerId } of orphanedUsers) {
      let currentManagerId: string | null = managerId;
      let resolved = false;
      const visited = new Set<string>();

      // Walk up to 10 levels (prevent infinite loops)
      for (let depth = 0; depth < 10 && currentManagerId; depth++) {
        if (visited.has(currentManagerId)) break;
        visited.add(currentManagerId);

        // Check if this manager is in our filtered list
        if (userMap.has(currentManagerId)) {
          userMap.get(currentManagerId)!.directReports!.push(user);
          console.log("[Graph] Chain resolved:", user.displayName, "→", userMap.get(currentManagerId)?.displayName, `(skipped ${depth} filtered-out manager(s))`);
          resolved = true;
          break;
        }

        // Manager not in list — look up THEIR manager
        try {
          const mgrResponse: { id?: string } = await client
            .api(`/users/${currentManagerId}/manager`)
            .select("id")
            .get();
          currentManagerId = mgrResponse?.id ?? null;
        } catch {
          // No manager found or API error — stop walking
          currentManagerId = null;
        }
      }

      if (!resolved) {
        roots.push(user);
      }
    }
  }

  const sortTree = (nodes: GraphUser[], isRoot = false) => {
    if (isRoot) {
      // At root level: Managing Partners first, then alphabetical within groups
      const MANAGING_PARTNER_NAMES = new Set([
        "george abro",
        "nathan shamo",
        "andrew shamo",
        "anthony karana",
        "kevin kajy",
        "donovan shaow",
      ]);
      const partners: GraphUser[] = [];
      const others: GraphUser[] = [];
      for (const node of nodes) {
        if (
          node.jobTitle?.toLowerCase().includes("managing partner") ||
          MANAGING_PARTNER_NAMES.has(node.displayName.toLowerCase())
        ) {
          partners.push(node);
        } else {
          others.push(node);
        }
      }
      partners.sort((a, b) => a.displayName.localeCompare(b.displayName));
      others.sort((a, b) => a.displayName.localeCompare(b.displayName));
      nodes.length = 0;
      nodes.push(...partners, ...others);
    } else {
      nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    for (const node of nodes) {
      if (node.directReports?.length) {
        sortTree(node.directReports);
      }
    }
  };

  sortTree(roots, true);
  const rootCount = roots.length;
  const managedCount = allUsers.length - rootCount;
  console.log("[Graph] Hierarchy built", { rootCount, managedCount, ms: Date.now() - startedAt });

  // Log root names for debugging misplaced users
  if (rootCount > 0 && rootCount < 50) {
    console.log("[Graph] Root users:", roots.map(r => r.displayName).join(", "));
  }

  orgHierarchyCache.value = roots;
  orgHierarchyCache.expiresAt = Date.now() + DIRECTORY_CACHE_TTL_MS;
  return roots;
  })().finally(() => {
    orgHierarchyCache.inFlight = null;
  });

  const hierarchy = await orgHierarchyCache.inFlight;
  return cloneDirectoryData(hierarchy);
}

/**
 * Get user count for stats
 */
export async function getUserCount(): Promise<number> {
  const client = await getGraphClient();

  const result = await client
    .api("/users/$count")
    .header("ConsistencyLevel", "eventual")
    .filter("accountEnabled eq true")
    .get();

  return typeof result === "number" ? result : 0;
}

// ─── User Photo Functions ─────────────────────────────────

/**
 * Get a user's profile photo as a Buffer (binary JPEG/PNG from Graph API)
 * Returns null if user has no photo or on error.
 */
export async function getUserPhoto(
  userId: string,
  size: "48x48" | "64x64" | "96x96" | "120x120" | "240x240" | "360x360" | "432x432" | "504x504" | "648x648" = "120x120"
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const client = await getGraphClient();
    const response = await client
      .api(`/users/${userId}/photos/${size}/$value`)
      .responseType("arraybuffer" as import("@microsoft/microsoft-graph-client").ResponseType)
      .get();

    return {
      data: Buffer.from(response),
      contentType: "image/jpeg",
    };
  } catch (error: unknown) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

    if (statusCode === 404) {
      // User has no photo set
      return null;
    }

    // Transient/permission/throttling/etc. should not be treated as permanent "no photo"
    throw error;
  }
}

// ─── OOO Functions ────────────────────────────────────────

export interface OofSettings {
  status: "disabled" | "alwaysEnabled" | "scheduled";
  externalAudience: "none" | "contactsOnly" | "all";
  scheduledStartDateTime?: { dateTime: string; timeZone: string };
  scheduledEndDateTime?: { dateTime: string; timeZone: string };
  internalReplyMessage?: string;
  externalReplyMessage?: string;
}

/**
 * Full mailbox settings shape (auto-reply + forwarding)
 */
export interface MailboxSettings {
  automaticRepliesSetting: OofSettings;
  forwardingSmtpAddress?: string | null;
}

/**
 * Get a user's full mailbox settings (auto-reply + forwarding)
 */
export async function getMailboxSettings(
  userPrincipalName: string
): Promise<MailboxSettings> {
  const client = await getGraphClient();

  const result = await client
    .api(`/users/${userPrincipalName}/mailboxSettings`)
    .select("automaticRepliesSetting,forwardingSmtpAddress")
    .get();

  return result;
}

/**
 * Get a user's OOF (Out of Office) automatic reply settings
 */
export async function getOofStatus(
  userPrincipalName: string
): Promise<OofSettings> {
  const client = await getGraphClient();

  const result = await client
    .api(`/users/${userPrincipalName}/mailboxSettings/automaticRepliesSetting`)
    .get();

  return result;
}

/**
 * Set a user's OOF automatic reply settings (auto-reply ONLY).
 * Forwarding is managed separately via ForwardingSchedule + inbox rules.
 */
export async function setOofStatus(
  userPrincipalName: string,
  settings: Partial<OofSettings>
): Promise<OofSettings> {
  const client = await getGraphClient();

  const result = await client
    .api(`/users/${userPrincipalName}/mailboxSettings`)
    .patch({
      automaticRepliesSetting: settings,
    });

  return result;
}

// ─── Email Forwarding Functions ───────────────────────────

export interface ForwardingRule {
  id: string;
  displayName: string;
  isEnabled: boolean;
  forwardTo: Array<{
    emailAddress: { name: string; address: string };
  }>;
  conditions?: {
    sentAfterDateTime?: string | { dateTime?: string; timeZone?: string };
    sentBeforeDateTime?: string | { dateTime?: string; timeZone?: string };
  };
}

const FORWARDING_RULE_NAME = "ProConnect OOO Forwarding";

/**
 * Get the current email forwarding rule for a user (if any)
 */
export async function getForwardingRule(
  userPrincipalName: string
): Promise<ForwardingRule | null> {
  const client = await getGraphClient();

  try {
    const result = await client
      .api(`/users/${userPrincipalName}/mailFolders/inbox/messageRules`)
      .get();

    const rules = result.value || [];
    console.log(`[Graph] getForwardingRule: found ${rules.length} total rules for ${userPrincipalName}`);
    const forwardingRule = rules.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.displayName === FORWARDING_RULE_NAME
    );

    if (!forwardingRule) {
      console.log(`[Graph] getForwardingRule: no rule named "${FORWARDING_RULE_NAME}" found`);
      return null;
    }

    console.log(`[Graph] getForwardingRule: found rule id=${forwardingRule.id}, isEnabled=${forwardingRule.isEnabled}`);
    return {
      id: forwardingRule.id,
      displayName: forwardingRule.displayName,
      isEnabled: forwardingRule.isEnabled,
      forwardTo: forwardingRule.actions?.forwardTo || [],
      conditions: forwardingRule.conditions || {},
    };
  } catch (err) {
    console.error(`[Graph] getForwardingRule FAILED for ${userPrincipalName}:`, err);
    return null;
  }
}

/**
 * Create or update an email forwarding rule.
 * By default the rule is created DISABLED (isEnabled: false) so it is
 * visible in Outlook but does not forward anything yet.  Pass
 * `enabled: true` to activate it immediately (e.g. when the start date
 * is already in the past).
 */
export async function setForwardingRule(
  userPrincipalName: string,
  forwardToEmail: string,
  forwardToName: string,
  enabled = false
): Promise<ForwardingRule> {
  const client = await getGraphClient();

  console.log(`[Graph] setForwardingRule called: upn=${userPrincipalName}, forward=${forwardToEmail}, enabled=${enabled}`);

  // Check if rule already exists
  const existing = await getForwardingRule(userPrincipalName);
  console.log(`[Graph] Existing rule:`, existing ? `id=${existing.id}, isEnabled=${existing.isEnabled}` : "none");

  const ruleBody = {
    displayName: FORWARDING_RULE_NAME,
    sequence: 1,
    isEnabled: enabled,
    conditions: {},
    actions: {
      forwardTo: [
        {
          emailAddress: {
            name: forwardToName || forwardToEmail,
            address: forwardToEmail,
          },
        },
      ],
      stopProcessingRules: false,
    },
  };

  console.log(`[Graph] Rule body:`, JSON.stringify(ruleBody));

  try {
    if (existing) {
      // Update existing rule
      console.log(`[Graph] PATCH existing rule ${existing.id}`);
      await client
        .api(
          `/users/${userPrincipalName}/mailFolders/inbox/messageRules/${existing.id}`
        )
        .patch(ruleBody);
      console.log(`[Graph] PATCH succeeded`);
    } else {
      // Create new rule
      console.log(`[Graph] POST new rule`);
      const created = await client
        .api(`/users/${userPrincipalName}/mailFolders/inbox/messageRules`)
        .post(ruleBody);
      console.log(`[Graph] POST succeeded, created rule id=${created?.id}, isEnabled=${created?.isEnabled}`);
    }
  } catch (err) {
    console.error(`[Graph] Rule creation/update FAILED:`, err);
    throw err;
  }

  const latest = await getForwardingRule(userPrincipalName);
  console.log(`[Graph] Verification read:`, latest ? `id=${latest.id}, isEnabled=${latest.isEnabled}` : "MISSING");
  if (!latest) {
    throw new Error("Forwarding rule update did not persist");
  }
  return latest;
}

/**
 * Enable an existing forwarding rule (flip isEnabled → true).
 * Used by the cron job when the scheduled start time arrives.
 */
export async function enableForwardingRule(
  userPrincipalName: string
): Promise<ForwardingRule | null> {
  const client = await getGraphClient();
  const existing = await getForwardingRule(userPrincipalName);
  if (!existing) return null;

  await client
    .api(
      `/users/${userPrincipalName}/mailFolders/inbox/messageRules/${existing.id}`
    )
    .patch({ isEnabled: true });

  return getForwardingRule(userPrincipalName);
}

/**
 * Disable an existing forwarding rule (flip isEnabled → false).
 * Used by the cron job when the scheduled end time arrives.
 */
export async function disableForwardingRule(
  userPrincipalName: string
): Promise<boolean> {
  const client = await getGraphClient();
  const existing = await getForwardingRule(userPrincipalName);
  if (!existing) return true;

  await client
    .api(
      `/users/${userPrincipalName}/mailFolders/inbox/messageRules/${existing.id}`
    )
    .patch({ isEnabled: false });

  return true;
}

/**
 * Delete the email forwarding rule entirely.
 */
export async function removeForwardingRule(
  userPrincipalName: string
): Promise<boolean> {
  const client = await getGraphClient();

  const existing = await getForwardingRule(userPrincipalName);
  if (!existing) return true;

  try {
    await client
      .api(
        `/users/${userPrincipalName}/mailFolders/inbox/messageRules/${existing.id}`
      )
      .delete();
    return true;
  } catch {
    return false;
  }
}
