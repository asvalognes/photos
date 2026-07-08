# Photos Foot Club

Application web (PWA mobile-first) permettant aux parents d'un club de football
d'envoyer facilement les photos des matchs de leurs enfants, sans installation
d'application, directement depuis leur téléphone.

Développée à l'origine pour l'A.S. Valognes, ce dépôt est conçu pour être
**repris et adapté par n'importe quel autre club**. Ce README explique
comment déployer l'outil chez vous, de zéro.

---

## Ce que fait l'outil

- Un parent crée un compte (email + mot de passe), reçoit un email de
  vérification, ainsi qu'un **QR code personnel** en pièce jointe (à imprimer
  et glisser dans sa coque de téléphone)
- Il peut ensuite se connecter de deux façons équivalentes : email/mot de
  passe classique, **ou** en scannant son QR code
- Une fois connecté, il peut envoyer une ou plusieurs photos d'un match,
  en choisissant la date et l'équipe concernée
- Les photos sont automatiquement rangées dans Google Drive selon une
  arborescence `date du match > équipe`
- En cas de perte du téléphone, un parent peut redemander un nouveau QR code
  (l'ancien devient alors invalide)

## Ce que ce projet n'est pas

- Ce n'est **pas** un service hébergé clé en main : chaque club déploie sa
  propre instance, avec ses propres comptes (Grist, Gmail, Google Drive, n8n,
  GitHub)
- Il n'y a **pas de base de données propriétaire à héberger** : tout repose
  sur des outils gratuits ou déjà disponibles dans la plupart des structures
  associatives ou académiques
- Pensé pour des clubs de taille modeste (dans l'idée, moins d'une
  cinquantaine de contributeurs actifs) — pas testé à plus grande échelle

---

## Stack technique

| Outil | Rôle | Coût |
|---|---|---|
| **n8n** | Orchestrateur : reçoit les appels du frontend, applique la logique métier, communique avec Grist/Drive/Gmail | Gratuit si auto-hébergé, sinon offre payante n8n Cloud |
| **Grist** | Base de données (comptes, sessions, tokens, équipes, photos) | Gratuit (plan Free largement suffisant à cette échelle) |
| **Gmail (SMTP)** | Envoi des emails transactionnels (vérification, QR code) | Gratuit avec un compte Gmail + mot de passe d'application |
| **Google Drive** | Stockage des fichiers photos | Gratuit dans la limite du quota du compte Google (15 Go partagés Gmail/Drive/Photos) |
| **GitHub Pages** | Hébergement du frontend statique (HTML/CSS/JS pur, sans framework) | Gratuit |

Aucun de ces outils n'est facturé à l'usage pour un volume de type "club
amateur". Le seul point à surveiller sur la durée est le quota de stockage
Google Drive.

---

## Pré-requis avant de commencer

Vous aurez besoin de :

1. Un **compte Grist** (gratuit sur [getgrist.com](https://www.getgrist.com))
2. Une **instance n8n** — auto-hébergée (ex. via un incubateur académique,
   un VPS, Docker) ou un compte [n8n Cloud](https://n8n.io)
3. Un **compte Gmail dédié** au club (ex. `photos.monclub@gmail.com`), avec
   un [mot de passe d'application](https://support.google.com/accounts/answer/185833)
   généré (nécessite la validation en deux étapes activée)
4. Un **projet Google Cloud** (gratuit) pour l'authentification OAuth2 à
   Google Drive
5. Un **compte GitHub** pour héberger le frontend

---

## Étapes de déploiement

### 1. Base de données Grist

Créez un nouveau document Grist avec les tables et colonnes suivantes :

**`Users`**
| Colonne | Type |
|---|---|
| Email | Text |
| Password_Hash | Text |
| Verified | Toggle |
| Role | Choice (`parent` / `admin`) |
| Created_At | Date/Time |
| Verification_Token | Text |
| Verification_Token_Expires | Date/Time |

**`Teams`**
| Colonne | Type |
|---|---|
| Name | Text |
| Category | Choice |

Remplissez cette table avec les équipes de votre club (une ligne par équipe).

**`QRTokens`**
| Colonne | Type |
|---|---|
| Token | Text |
| Expires_At | Date/Time (laissé vide — token permanent) |
| User | Reference → Users |

**`Sessions`**
| Colonne | Type |
|---|---|
| Token | Text |
| User | Reference → Users |
| Created_At | Date/Time |
| Expires_At | Date/Time |

**`Photos`**
| Colonne | Type |
|---|---|
| Drive_File_Id | Text |
| Match_Date | Date |
| Created_At | Date/Time |
| User | Reference → Users |
| Team | Reference → Teams |

Notez l'**ID du document** Grist (visible dans l'URL, ex.
`https://docs.getgrist.com/VOTRE_ID_ICI/...`) : il sera réutilisé dans tous
les workflows n8n.

### 2. Google Drive

1. Créez manuellement un dossier racine dans Google Drive (ex. "Photos Mon
   Club"), depuis le compte Gmail dédié au club
2. Notez son **ID de dossier** (dans l'URL du dossier)

### 3. Google Cloud (pour l'accès Drive)

1. Créez un projet sur [console.cloud.google.com](https://console.cloud.google.com)
2. Activez l'API **Google Drive** (`drive.googleapis.com`)
3. Configurez l'écran de consentement OAuth (type "Externe"), en ajoutant le
   compte Gmail du club comme utilisateur test
4. Créez un identifiant OAuth2 de type "Application Web", avec comme URI de
   redirection autorisée :
   ```
   https://VOTRE-INSTANCE-N8N/rest/oauth2-credential/callback
   ```

### 4. n8n — credentials

Dans votre instance n8n, créez 4 credentials :

- **Header Auth** : un header personnalisé (ex. `X-API-Key`) avec une valeur
  secrète de votre choix — c'est la clé qui protégera tous vos webhooks
- **Grist API** : votre clé API Grist (disponible dans les paramètres de
  votre compte Grist)
- **SMTP** : host `smtp.gmail.com`, port `465`, SSL/TLS activé, identifiants
  = votre compte Gmail dédié + le mot de passe d'application généré à
  l'étape des pré-requis
- **Google Drive OAuth2 API** : utilisez le Client ID/Secret créés à l'étape 3

### 5. n8n — import des workflows

Les 7 workflows sont fournis en JSON dans le dossier `/n8n-workflows` de ce
dépôt :

| Workflow | Rôle |
|---|---|
| `signup.json` | Inscription, envoi de l'email de vérification + QR code |
| `verify-email.json` | Validation du lien de vérification |
| `login.json` | Connexion email + mot de passe |
| `qr-login.json` | Connexion par scan du QR code |
| `photo-upload.json` | Réception et rangement des photos dans Drive |
| `get-teams.json` | Liste des équipes (alimente le menu déroulant du frontend) |
| `regenerate-qr-token.json` | Réémission d'un nouveau QR code en cas de perte |

**Pour chaque fichier :**
1. Créez un nouveau workflow vide dans n8n
2. Menu (⋯) → **Import from File**, sélectionnez le fichier
3. **Remplacez toutes les valeurs spécifiques à ASVA** par les vôtres :
   - `docId` : votre ID de document Grist
   - Les credentials (Header Auth, Grist, SMTP, Google Drive) : re-sélectionnez
     les vôtres sur chaque nœud concerné
   - Dans `photo-upload.json` : l'ID du dossier racine Google Drive
     (`1f_Lw7AMt6EGOaHc9xq22JnwfVb49U6Dn` dans l'original — remplacez par le
     vôtre)
   - Dans `signup.json` et `regenerate-qr-token.json` : l'URL de votre
     frontend (`https://asvalognes.github.io/photos/...` → la vôtre)
4. Sur le nœud **Webhook** de chaque workflow : renseignez **Options →
   Allowed Origins (CORS)** avec l'URL de votre frontend GitHub Pages
5. **Activez** le workflow (bascule en haut à droite) — un workflow inactif
   ne répond pas du tout sur son URL de production, ce qui se manifeste côté
   navigateur par une erreur `Failed to fetch`, comme un blocage CORS. Si
   quelque chose ne répond pas, vérifiez toujours **1) le workflow est-il
   actif ? 2) le CORS est-il configuré ?**, dans cet ordre.

> **Point technique important :** le nœud `Respond to Webhook` doit avoir un
> `Response Body` commençant par `=` pour que les expressions `{{ }}` soient
> évaluées — sauf en cas d'expression contenant un opérateur ternaire, où le
> `=` peut provoquer une erreur "Invalid JSON" (dans ce cas, retirez le `=`
> et gardez des expressions simples sans ternaire).

> **Point technique important :** le Task Runner de certaines instances n8n
> auto-hébergées bloque `require('crypto')` et `crypto.subtle`. Le hash des
> mots de passe est donc implémenté en JavaScript pur (SHA-256) directement
> dans les nœuds Code — aucune dépendance externe requise.

### 6. Frontend

1. Forkez ou clonez ce dépôt
2. Renommez/adaptez `assets/logo.png` avec le logo de votre club
3. Modifiez `css/style.css` : les couleurs sont centralisées en haut du
   fichier (variables CSS `--club-blue`, `--club-red`, etc.) — changez-les
   pour matcher l'identité visuelle de votre club
4. Modifiez `js/config.js` :
   ```javascript
   const N8N_BASE_URL = "https://votre-instance-n8n/webhook";
   const API_KEY = "votre-cle-secrete-header-auth";
   ```
5. Activez **GitHub Pages** dans les paramètres du dépôt (Settings → Pages),
   source = branche `main`, dossier `/ (root)`
6. Votre site sera disponible à `https://votre-compte-github.github.io/votre-depot/`

### 7. Tests de bout en bout

Dans cet ordre, en conditions réelles depuis le site déployé :

1. Inscription avec un vrai email → réception du mail de vérification +
   QR code en pièce jointe
2. Clic sur le lien de vérification → compte activé
3. Connexion email/mot de passe → accès à la page d'upload
4. Upload de 2-3 photos → vérifiez leur présence dans Google Drive
   (`date > équipe`) et les lignes créées dans la table `Photos`
5. Déconnexion, puis reconnexion en scannant le QR code reçu par email
6. (Optionnel) Test de `regenerate-qr.html` : régénération du QR code,
   vérification que l'ancien ne fonctionne plus

---

## Sécurité — points à ne pas négliger

- La clé `X-API-Key` (Header Auth) est visible côté client dans
  `js/config.js`, puisque c'est un site statique sans backend caché. Ce n'est
  pas un problème en soi (elle protège juste vos webhooks d'appels
  anonymes), mais **ne réutilisez jamais cette clé pour autre chose**, et
  régénérez-la si vous pensez qu'elle a fuité
- HTTPS obligatoire sur l'instance n8n et sur GitHub Pages (les deux le sont
  par défaut)
- Les mots de passe ne sont jamais stockés en clair (hash SHA-256)
- Les tokens de vérification d'email expirent après 24h
- Les sessions expirent après 30 jours
- Le QR code est un token **permanent** tant qu'il n'est pas régénéré via
  `regenerate-qr-token` — pensez à informer vos utilisateurs de ne pas le
  partager
- Vérifiez la conformité RGPD de votre club concernant le stockage de photos
  de mineurs sur Google Drive (contexte associatif/académique généralement
  couvert, mais à valider selon votre situation)

## Limites connues

- Pensé pour un usage associatif modeste (quelques dizaines de
  contributeurs actifs), pas testé à plus grande échelle
- Un seul rôle "parent" et un rôle "admin" existent dans le modèle de
  données, mais aucune interface d'administration n'est fournie à ce stade
  (gestion des équipes/utilisateurs à faire directement dans Grist)
- Pas de suppression de compte ni de droit à l'oubli automatisé — à gérer
  manuellement si demandé

## Licence

Aucune licence formelle définie à ce stade — contactez le club d'origine
(A.S. Valognes) si vous souhaitez réutiliser ou adapter ce projet.
