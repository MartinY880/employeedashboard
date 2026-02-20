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
  "department",
  "officeLocation",
].join(",");

// ─── Directory Functions ──────────────────────────────────

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  directReports?: GraphUser[];
  manager?: GraphUser | null;
}

/**
 * Get all users from the directory
 */
export async function getAllUsers(): Promise<GraphUser[]> {
  const client = await getGraphClient();

  const result = await client
    .api("/users")
    .select(USER_SELECT)
    .top(999)
    .filter("accountEnabled eq true")
    .get();

  return result.value || [];
}

/**
 * Get a user's direct reports recursively (builds org tree)
 */
export async function getUserWithReports(userId: string): Promise<GraphUser> {
  const client = await getGraphClient();

  // Get user details
  const user: GraphUser = await client
    .api(`/users/${userId}`)
    .select(USER_SELECT)
    .get();

  // Get direct reports
  const reportsResult = await client
    .api(`/users/${userId}/directReports`)
    .select(USER_SELECT)
    .get();

  const directReports = reportsResult.value || [];

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
  const client = await getGraphClient();

  // Get all users
  const allUsers = await getAllUsers();

  // Find top-level users (no manager) by checking each
  const topLevel: GraphUser[] = [];

  for (const user of allUsers) {
    try {
      await client.api(`/users/${user.id}/manager`).select("id").get();
      // Has manager — skip
    } catch {
      // No manager — this is a top-level user
      topLevel.push(user);
    }
  }

  // Build tree from top-level users
  return Promise.all(topLevel.map((u) => getUserWithReports(u.id)));
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
  } catch {
    // User has no photo set, or other error
    return null;
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
 * Set a user's OOF automatic reply settings
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
    const forwardingRule = rules.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.displayName === FORWARDING_RULE_NAME
    );

    if (!forwardingRule) return null;

    return {
      id: forwardingRule.id,
      displayName: forwardingRule.displayName,
      isEnabled: forwardingRule.isEnabled,
      forwardTo: forwardingRule.actions?.forwardTo || [],
    };
  } catch {
    return null;
  }
}

/**
 * Create or update an email forwarding rule
 */
export async function setForwardingRule(
  userPrincipalName: string,
  forwardToEmail: string,
  forwardToName: string
): Promise<ForwardingRule> {
  const client = await getGraphClient();

  // Check if rule already exists
  const existing = await getForwardingRule(userPrincipalName);

  const ruleBody = {
    displayName: FORWARDING_RULE_NAME,
    sequence: 1,
    isEnabled: true,
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

  if (existing) {
    // Update existing rule
    const result = await client
      .api(
        `/users/${userPrincipalName}/mailFolders/inbox/messageRules/${existing.id}`
      )
      .patch(ruleBody);
    return result;
  } else {
    // Create new rule
    const result = await client
      .api(`/users/${userPrincipalName}/mailFolders/inbox/messageRules`)
      .post(ruleBody);
    return result;
  }
}

/**
 * Disable (delete) the email forwarding rule
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
