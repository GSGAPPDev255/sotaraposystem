/**
 * Microsoft Graph API client helpers.
 * Uses client credentials (daemon) flow — no user context required.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

let _cachedToken: { token: string; expiresAt: number } | null = null;

/** Obtain an MS Graph access token via client credentials. */
export async function getGraphToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token;
  }

  const tenantId = Deno.env.get('AZURE_TENANT_ID')!;
  const clientId = Deno.env.get('AZURE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')!;

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: 'POST', body: params },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph token fetch failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return _cachedToken.token;
}

/** Generic authenticated Graph API GET. */
export async function graphGet<T>(path: string): Promise<T> {
  const token = await getGraphToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph GET ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Get unread messages in the finance mailbox. */
export async function getUnreadMessages(mailbox: string) {
  const path = `/users/${encodeURIComponent(mailbox)}/messages?$filter=isRead eq false&$top=50&$select=id,subject,from,receivedDateTime,hasAttachments,body`;
  return graphGet<{ value: GraphMessage[] }>(path);
}

/** Get attachments for a message. */
export async function getMessageAttachments(mailbox: string, messageId: string) {
  const path = `/users/${encodeURIComponent(mailbox)}/messages/${messageId}/attachments`;
  return graphGet<{ value: GraphAttachment[] }>(path);
}

/** Mark a message as read. */
export async function markMessageRead(mailbox: string, messageId: string): Promise<void> {
  const token = await getGraphToken();
  await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead: true }),
  });
}

/** Search for users in Azure AD by display name or email. */
export async function searchUsers(query: string): Promise<AzureAdUser[]> {
  const token = await getGraphToken();

  // Use $search for display name and mail matching (requires ConsistencyLevel: eventual)
  const encodedQuery = encodeURIComponent(query);
  const res = await fetch(
    `${GRAPH_BASE}/users?$search="displayName:${encodedQuery}" OR "mail:${encodedQuery}"&$select=id,displayName,mail,department,jobTitle,accountEnabled&$top=15&$filter=accountEnabled eq true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual',  // Required for $search
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph search failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return (data.value ?? []).map((u: any) => ({
    azure_oid: u.id,
    display_name: u.displayName,
    email: u.mail,
    department: u.department || '',
    job_title: u.jobTitle || '',
  }));
}

/** Send an email from the finance mailbox. */
export async function sendMail(from: string, message: GraphSendMailPayload): Promise<void> {
  const token = await getGraphToken();
  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendMail failed: ${res.status} ${body}`);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  receivedDateTime: string;
  hasAttachments: boolean;
  body: { contentType: string; content: string };
}

export interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes: string; // base64
}

export interface GraphSendMailPayload {
  message: {
    subject: string;
    body: { contentType: 'HTML' | 'Text'; content: string };
    toRecipients: { emailAddress: { address: string; name?: string } }[];
    ccRecipients?: { emailAddress: { address: string } }[];
  };
  saveToSentItems: boolean;
}

export interface AzureAdUser {
  azure_oid: string;
  display_name: string;
  email: string;
  department?: string;
  job_title?: string;
}
