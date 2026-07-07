// ===================================================================
// api.js — fonctions communes d'appel aux webhooks n8n
// ===================================================================

/**
 * Appelle un webhook n8n en JSON et retourne la réponse parsée.
 * Lève une erreur avec le message renvoyé par n8n en cas d'échec.
 */
async function callWebhook(path, body) {
  const response = await fetch(`${N8N_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue. Réessaie dans un instant.");
  }

  return data;
}

/**
 * Appelle un webhook n8n avec un FormData (upload de fichiers).
 * Ne pas fixer le header Content-Type : le navigateur doit générer
 * lui-même la boundary multipart.
 */
async function callWebhookFormData(path, formData) {
  const response = await fetch(`${N8N_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue. Réessaie dans un instant.");
  }

  return data;
}

async function callWebhookGet(path) {
  const response = await fetch(`${N8N_BASE_URL}/${path}`, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue. Réessaie dans un instant.");
  }

  return data;
}

const api = {
  signup(email, password) {
    return callWebhook("signup", { email, password });
  },

  getTeams() {
    return callWebhookGet("get-teams");
  },

  verifyEmail(email, token) {
    return callWebhook("verify-email", { email, token });
  },

  login(email, password) {
    return callWebhook("login", { email, password });
  },

  qrLogin(token) {
    return callWebhook("qr-login", { token });
  },

  uploadPhotos(sessionToken, matchDate, teamId, files) {
    const formData = new FormData();
    formData.append("session_token", sessionToken);
    formData.append("match_date", matchDate);
    formData.append("team_id", teamId);
    for (const file of files) {
      formData.append("photos", file);
    }
    return callWebhookFormData("photo-upload", formData);
  },
};
