// ===================================================================
// auth.js — gestion de la session utilisateur en localStorage
// ===================================================================

const SESSION_KEY = "photos_foot_club_session";

const auth = {
  /**
   * Enregistre la session après une connexion réussie
   * (par login classique ou par QR code).
   */
  saveSession(sessionToken, email, role) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ sessionToken, email, role })
    );
  },

  /**
   * Retourne la session en cours, ou null si personne n'est connecté.
   */
  getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  clearSession() {
    localStorage.removeItem(SESSION_KEY);
  },

  /**
   * À appeler en haut des pages qui nécessitent d'être connecté.
   * Redirige vers la page de connexion si aucune session n'est trouvée.
   * Ne vérifie pas l'expiration ici : c'est photo-upload (côté n8n) qui
   * fait foi et renvoie une 401 si la session a expiré, auto-déconnectant
   * alors l'utilisateur (voir upload.html).
   */
  requireAuth() {
    const session = this.getSession();
    if (!session) {
      window.location.href = "index.html";
      return null;
    }
    return session;
  },
};
