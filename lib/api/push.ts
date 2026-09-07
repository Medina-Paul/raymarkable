/**
 * CLIENT SDK: WEB PUSH
 */

const API_BASE = '/api/v1';

export async function subscribePush(payload: {
  endpoint: string;
  keys: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return { success: true };
  }

  const errText = await res.text().catch(() => "");
  return { success: false, error: `Server rejected registration (${res.status}): ${errText || res.statusText}` };
}

export async function unsubscribePush(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
