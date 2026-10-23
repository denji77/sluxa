# Sluxa Mobile (Expo / React Native)

Full-featured Android/iOS client for the Sluxa character-AI backend. Same
Clerk account, same FastAPI backend, same characters and chats as the webapp.

**Features:** email/password auth (Clerk), character list + create/edit/delete,
1-on-1 chats with typing indicator and descriptive/casual modes, group chats
with the full staggered replay engine (hesitations, reactions, read receipts,
interrupts, cross-talk, ambient chatter), Chub.ai discovery + import,
lorebooks with entry management, RAG memory inspector, in-app configurable
server URL.

---

## Run it right now (Expo Go)

1. **Start the backend so the phone can reach it** (from `backend/`):

   ```powershell
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

   `--host 0.0.0.0` is required — the default `127.0.0.1` is not reachable
   from the phone.

2. **Start Metro** (from `mobile/`):

   ```powershell
   npx expo start
   ```

3. Install **Expo Go** on your Android phone, make sure the phone is on the
   **same Wi-Fi** as this PC, and scan the QR code from the terminal.

The app defaults to `http://192.168.0.101:8000` (this PC's LAN IP when it was
built). If your PC's IP changes, either update `.env` → `EXPO_PUBLIC_API_URL`
(restart Metro), or just change it live in the app: **Profile → Server →
Backend URL** (persists across restarts, shows a live connection check).

### If the phone can't connect

- Confirm PC and phone are on the same network.
- Windows may classify your Wi-Fi as a *Public* network, where inbound Python
  is blocked. Set it to Private: **Settings → Network & Internet → Wi-Fi →
  (your network) → Private network profile**, or allow Python through the
  firewall (admin PowerShell):

  ```powershell
  New-NetFirewallRule -DisplayName "Sluxa backend 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
  ```

- Test from the phone's browser: `http://<pc-ip>:8000/health` should return
  `{"status":"healthy"}`.

---

## Build the APK

Configs are ready (`app.json` + `eas.json`, preview profile = installable APK).
You need a free [Expo account](https://expo.dev):

```powershell
cd mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

The build runs on Expo's servers (~10-20 min) and gives you a download link
for the APK — install it directly on any Android phone. Cleartext HTTP is
enabled (`expo-build-properties`) so the APK can talk to your LAN backend.

To change the backend URL baked into a build, edit the `env` block in
`eas.json` — or don't bother: the in-app Server setting overrides it anywhere.

### Publishing to Play Store later

```powershell
npx eas-cli build --platform android --profile production
```

Produces an `.aab` bundle. Before publishing for real users you'll want the
backend deployed to a public HTTPS URL (Render/Railway/Fly/VPS) and set as
`EXPO_PUBLIC_API_URL` in the production profile, plus Clerk switched to a
production instance (`pk_live_…`).

---

## Architecture

```
mobile/
├── app/                        # expo-router file-based routes
│   ├── _layout.tsx             # ClerkProvider + server-URL bootstrap
│   ├── index.tsx               # auth-based redirect
│   ├── (auth)/                 # sign-in, sign-up (email code verification)
│   └── (app)/                  # auth-guarded; wires Clerk token → API client
│       ├── (tabs)/             # Chats | Characters | Discover | Profile
│       ├── chat/[id]           # 1-on-1 chat
│       ├── group-chat/[id]     # group chat + staggered replay engine
│       ├── group-chat/new      # participant picker (2-6 characters)
│       ├── character/[id|new]  # detail / edit / create
│       ├── chub/[id]           # Chub.ai character detail + import
│       ├── lorebooks/…         # lorebook list + entry CRUD
│       └── memories/[chatId]   # RAG memory inspector
└── src/
    ├── api/client.ts           # axios + Clerk token injection + runtime base URL
    ├── api/index.ts            # typed endpoint wrappers (mirror of backend routes)
    ├── types.ts                # TS mirrors of FastAPI schemas
    ├── theme.ts                # dark design system (violet→pink gradients)
    ├── utils/time.ts           # time context sent to the AI
    └── components/             # Avatar, bubbles, TypingDots, inputs, etc.
```

Notes:

- The API client fetches a fresh Clerk token per request (Clerk caches
  internally), so auth never goes stale.
- The group-chat replay engine mirrors `frontend/src/pages/GroupChatPage.jsx`
  semantics exactly: `hesitation` / `reaction` / `left_on_read` virtual
  messages, `interrupt` (pops in fast), `concurrent` (types in parallel),
  per-character typing speed, ambient messages after 60-90s of silence.
- `npm` needs `legacy-peer-deps` (see `.npmrc`) because the SDK 57 template
  pins react 19.2.3 while react-dom wants ^19.2.7. EAS respects `.npmrc`.
