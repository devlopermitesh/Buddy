# SocialFlow: Complete Spec from Whimsical Board 1 and Board 2

This document describes everything on the two Whimsical boards, node by node and arrow by arrow, so a developer (or OpenCode) can implement without guessing.

- **Board 1:** SocialFlow – Board 1: Complete Product Sitemap
  https://whimsical.com/socialflow-board-1-complete-product-sitemap-B8A4UpW5ig6z5iajeR8wGJ
- **Board 2 (v2):** SocialFlow – Board 2: Authentication and Onboarding (v2)
  https://whimsical.com/socialflow-board-2-authentication-and-onboarding-v2-GyTrBWFup1pUf9Kao6mjPZ
  (An earlier board named "Board 2: Authentication and Onboarding" without "v2" is superseded and should be ignored or deleted.)

Companion files: `socialflow.dbml` (database), `socialflow-opencode-prompt.md` (build prompt).

**Legend:** A = Admin, M = Manager, E = Executive.

**Status of this doc:** Items marked *(suggested)* are not drawn on the boards; they are implementation suggestions. Everything else is taken directly from the boards.

---

# PART 1: BOARD 1, COMPLETE PRODUCT SITEMAP

Board 1 has two diagrams: (1) a **sitemap mind map** (navigation hierarchy and role access) and (2) a **page-relationship flowchart** (which page leads to which page).

## 1.1 Sitemap mind map

Root: **SocialFlow Sitemap** with four branches.

### Branch 1: Public and Auth (no sidebar)
- Login
- Sign up
- Forgot password
- Reset password
- Verify email
- Accept invitation (via invite link)
- Session expired (re-login)

### Branch 2: Onboarding Wizard (first run, Admin)
1. Step 1: Create workspace
2. Step 2: Invite team and assign roles
3. Step 3: Connect Instagram and Facebook
4. Step 4: Connect Discord (optional)
5. Step 5: Onboarding complete, go to Dashboard

### Branch 3: App Shell (persistent sidebar and top bar)

**Top bar**
- Workspace switcher
- Global search
- Notification bell
- Profile menu (profile, logout)

**Sidebar group OVERVIEW**
- **Dashboard** [A M E]
  - Summary widgets (scheduled, published, approvals, failures)
  - Today's tasks
  - Publishing queue preview
  - Account overview (account health)
  - Activity center (team and system activity)
  - AI recommendations panel
- **Notifications** [A M E]
  - Notification center (all, unread)
  - Notification preferences

**Sidebar group CONTENT**
- **Content Studio** [A M E]
  - Post composer
  - Platform-specific caption and preview
  - Drafts list
  - Post detail and status history
- **Media Library** [A M E]
  - Asset grid and folders
  - Upload
  - Asset detail (alt text, tags, usage)
- **Content Calendar** [A M E]
  - Month view
  - Week view
  - Day view
  - Content gaps overlay
- **Publishing Queue** [A M E]
  - Scheduled
  - Processing
  - Published
  - Failed (retry or troubleshoot)
- **Approval Center** [A M]
  - Pending review
  - Reviewed history
  - Revision requested
  - Review detail (approve, reject, request revision)
  - E sees own submissions status only

**Sidebar group AUTOMATION**
- **AI Smart Scheduling** [A M E]
  - Recommended posting times
  - Available slots
  - Historical engagement insights
  - Content gap suggestions
- **Automation Center** [A M]
  - Automation rules list (enable, disable)
  - Rule editor
  - Execution history

**Sidebar group PLANNING**
- **Tasks** [A M E]
  - Board view
  - List view
  - My tasks
  - Task detail and comments
- **Campaigns** [A M]
  - Campaign list
  - Campaign detail (posts, tasks, results)
  - Create or edit campaign

**Sidebar group INSIGHTS**
- **Analytics** [A M E]
  - Account analytics
  - Post-level analytics
  - Best-time insights
- **Reports** [A M]
  - Daily reports
  - Weekly reports
  - Report detail and export

**Sidebar group WORKSPACE**
- **Team Management** [A M]
  - Members list
  - Invitations (M can invite, A can invite and manage)
  - Roles and permissions (A only)
- **Connected Accounts** [A M]
  - Accounts list and health
  - Connect Instagram or Facebook
  - Reconnect expired account
  - Disconnect account
- **Discord Integration** [A configures, M and E view own link]
  - Server connection
  - Channel mapping
  - Command permissions (A only)
  - Discord user links
  - Notification settings
  - Command execution history
- **Settings** [A: all, M and E: profile only]
  - Workspace settings (A)
  - My profile and security
  - Preferences (timezone, notifications)
- **Audit Logs** [A]
  - User activity
  - Automation and AI activity
  - Discord command activity
  - Filters and export

### Branch 4: System Pages
- 403 No permission
- 404 Not found
- Empty workspace state
- Disconnected account banner (links to Connected Accounts)
- Maintenance or error page

## 1.2 Role access matrix (from the [A M E] tags)

| Page | Admin | Manager | Executive | Note |
|---|---|---|---|---|
| Dashboard | yes | yes | yes | |
| Notifications | yes | yes | yes | |
| Content Studio | yes | yes | yes | |
| Media Library | yes | yes | yes | |
| Content Calendar | yes | yes | yes | |
| Publishing Queue | yes | yes | yes | |
| Approval Center | yes | yes | limited | E sees only the status of own submissions |
| AI Smart Scheduling | yes | yes | yes | |
| Automation Center | yes | yes | no | |
| Tasks | yes | yes | yes | |
| Campaigns | yes | yes | no | |
| Analytics | yes | yes | yes | |
| Reports | yes | yes | no | |
| Team Management | yes | yes | no | Roles and permissions: Admin only. Invitations: Manager can invite, Admin can invite and manage |
| Connected Accounts | yes | yes | no | |
| Discord Integration | configures | view own link | view own link | Command permissions: Admin only |
| Settings | all | profile only | profile only | Workspace settings: Admin only |
| Audit Logs | yes | no | no | |

Assumptions (made by the designer, not given in the original blueprint): Audit Logs Admin only; Reports, Campaigns and Automation Center Admin and Manager; Executive sees only own submission status in Approval Center.

Rule: the UI hides pages the role cannot use, but the **backend must enforce every permission**. An Executive who opens an Admin URL directly sees **403 No permission**.

## 1.3 Page-relationship flowchart (all 40 arrows)

Node colors on the board: grey = Auth pages, yellow = decision, purple = Onboarding, Analytics and Reports, blue = Dashboard and Notifications, green = content group (Studio, Media, Calendar, Queue, Approvals), orange = AI Scheduling and Automation Center, yellow = Tasks and Campaigns, red = workspace group (Accounts, Team, Discord, Settings, Audit Logs), dashed grey = 403.

### Entry and onboarding routing
| # | From | To | Arrow label |
|---|---|---|---|
| 1 | Login | Has workspace? (decision) | success |
| 2 | Sign up | Verify email | |
| 3 | Verify email | Has workspace? | verified |
| 4 | Accept invitation | Dashboard | joins workspace |
| 5 | Has workspace? | Onboarding Wizard | no |
| 6 | Has workspace? | Dashboard | yes |
| 7 | Onboarding Wizard (create workspace, invite, connect accounts, Discord) | Dashboard | complete |

### From the Dashboard (cards and alerts are links)
| # | From | To | Arrow label |
|---|---|---|---|
| 8 | Dashboard | Content Studio | Create post |
| 9 | Dashboard | Approval Center | Pending approvals card |
| 10 | Dashboard | Publishing Queue | Failed post card |
| 11 | Dashboard | Tasks | Today's tasks |
| 12 | Dashboard | AI Smart Scheduling | AI recommendation |
| 13 | Dashboard | Connected Accounts | Token expired alert |
| 14 | Dashboard | Notifications | Bell |

### Notification deep links
| # | From | To | Arrow label |
|---|---|---|---|
| 15 | Notifications | Approval Center | Deep link |
| 16 | Notifications | Publishing Queue | Deep link |
| 17 | Notifications | Tasks | Deep link |

### Content loop
| # | From | To | Arrow label |
|---|---|---|---|
| 18 | Content Studio | Media Library | Pick or upload asset |
| 19 | Media Library | Content Studio | Insert into post |
| 20 | Content Studio | Approval Center | Submit for approval |
| 21 | Content Studio | Content Calendar | Schedule |
| 22 | Content Studio | Publishing Queue | Publish now |
| 23 | Content Calendar | Content Studio | New or edit on date |
| 24 | Approval Center | Content Studio | Revision requested |
| 25 | Approval Center | Publishing Queue | Approved and scheduled |
| 26 | Publishing Queue | Content Studio | Edit failed post |
| 27 | Publishing Queue | Connected Accounts | Reconnect account |

### AI and automation
| # | From | To | Arrow label |
|---|---|---|---|
| 28 | AI Smart Scheduling | Content Calendar | Accept slot |
| 29 | AI Smart Scheduling | Automation Center | Manage rules |
| 30 | Automation Center | AI Smart Scheduling | Run history |

### Planning and insights
| # | From | To | Arrow label |
|---|---|---|---|
| 31 | Tasks | Campaigns | Linked campaign |
| 32 | Campaigns | Content Calendar | Campaign posts |
| 33 | Campaigns | Analytics | Campaign results |
| 34 | Analytics | Reports | Generate report |

### Workspace administration
| # | From | To | Arrow label |
|---|---|---|---|
| 35 | Discord Integration | Team Management | Link Discord users |
| 36 | Discord Integration | Approval Center | /approve command |
| 37 | Discord Integration | Audit Logs | Command history |
| 38 | Team Management | Audit Logs | Role changes logged |
| 39 | Settings | Discord Integration | Integrations |
| 40 | Settings | 403 No permission | Executive opens workspace settings |

## 1.4 Suggested route map *(suggested, not on the board)*

```
Public:      /login  /signup  /forgot-password  /reset-password  /verify-email
             /invite/[token]  /session-expired  /select-workspace
Onboarding:  /onboarding/[step]            (step 1 to 5)
App (per workspace slug), all under /w/[workspaceSlug]/ :
             dashboard  notifications  content-studio (new, [postId], drafts)
             media  calendar  queue  approvals  ai-scheduling  automation
             tasks  campaigns  analytics  reports  team  accounts
             discord  settings  activity-logs
System:      /403  /404  /error
```

---

# PART 2: BOARD 2 (v2), AUTHENTICATION AND ONBOARDING

Board 2 has six flowcharts (Flow A to F) plus one specification table. Dashed purple "pill" nodes are **jump links** to another flow.

Colors: blue = user-facing screen or form, yellow diamond = decision, green = backend operation, red = error state, orange = warning or skipped state, purple = onboarding step or jump link.

## Flow A: Sign up, verification and login

Start: **Open app URL**, then decision **Valid session?**
- yes, go to **Flow D (workspace routing)**, or **Flow C** if an invite token is pending.
- no, decision **Login or Sign up?**

### Sign up branch
1. **Sign up form** (name, email, password).
2. Decision **Valid?** (email format, password policy, email unique).
   - no: **Inline errors** (if the email exists, show a link to Login), user fixes and resubmits.
   - yes: **Create user (unverified)** and **send verification email**.
3. **User clicks verification link.**
4. Decision **Token valid and unexpired?**
   - no: **Expired or invalid link** with Resend (rate limited), which issues a new link back to step 3.
   - yes: **Mark email verified**, then **auto login** into **Create session** (access + refresh token).

### Login branch
1. **Login form** (email, password).
2. Decision **Credentials valid?**
   - no: **Generic error**: "Invalid email or password". After 5 failures: temporary lockout. Offer Forgot password (jump to **Flow B**) or retry.
   - yes: decision **Email verified?**
     - no: **Verify-email screen** with Resend option, which sends a link back to the verification step.
     - yes: **Create session** (access + refresh token).
3. After **Create session**: continue to **Flow D (workspace routing)**, or **Flow C** if an invite token is pending.

## Flow B: Password reset and session expiry

### Password reset
1. **Forgot password** (enter email).
2. **Always show: "If account exists, email sent."** (no account enumeration). Send reset link, valid 1 hour.
3. User opens the link, then **Reset form** (new password).
4. Decision **Token valid, unused, and password policy met?**
   - no: **Show error**, request new link (back to step 1).
   - yes: **Update password hash**, mark token used, **revoke all sessions**, then "login again" (jump to **Flow A: Login**).

### Session expiry (edge case)
1. Trigger: **access token expires mid-use or mid-onboarding**.
2. Decision **Refresh token valid?**
   - yes: **Silent refresh** and retry the failed request.
   - no: **Redirect to login**, keep the return URL; onboarding step is saved server-side. After login, "resume saved onboarding step if incomplete" (jump to **Flow D**).

## Flow C: Invitation acceptance and role assignment

1. **User opens invitation link.**
2. Decision **Invite pending, unexpired and not revoked?**
   - no: **Invalid or expired invite**, "Ask Admin to resend".
   - yes: decision **Account exists for invited email?**
     - yes: jump to **Flow A: Login (invite token kept)**.
     - no: jump to **Flow A: Sign up (email locked to invite)**.
3. After login or verified signup: **Returns with session + invite token.**
4. Decision **Logged-in email matches invite?**
   - no: **Email mismatch**, "Switch account" (back to Flow A Login).
   - yes: decision **Workspace active?**
     - no: **Workspace unavailable**, show error.
     - yes: **Accept invite (transaction)**: create `workspace_members` with the invited role, invite status `accepted`, log activity.
5. Result: **Dashboard (role-based sidebar)**.

## Flow D: Workspace routing, Step 1 (workspace) and Step 2 (team)

Entry: **From Flow A: session created.**

### Routing
1. Decision **Member of a workspace?**
   - no: go to **Step 1: Create workspace**.
   - yes: decision **Admin with onboarding incomplete?**
     - yes: **Resume at saved onboarding step** (to Step 2 on the board; implement as "saved step").
     - no: decision **More than one workspace?**
       - yes: **Workspace picker**, then **Dashboard**.
       - no: **Dashboard (role-based sidebar)**.

### Step 1: Create workspace (name, slug, timezone)
1. Decision **Name valid and slug unique?**
   - no: **Show errors**, **suggest alternative slug**, user fixes.
   - yes: **DB transaction**: create workspace, create owner membership with role Admin, seed default `role_permissions`, log activity, save `onboarding_step = 2`.
2. Go to Step 2.

### Step 2: Invite team (skippable); email + role (Admin, Manager or Executive)
1. User can **Skip**, which goes to Flow E (Step 3).
2. Or submit an invite. Decision **Email valid, not a member, no pending invite?**
   - no: **Inline error** (already member or pending invite), user fixes.
   - yes: **Create invitation** (token hash stored, 7-day expiry), send email, log activity.
3. Decision **Add another?**
   - yes: back to the invite form.
   - no: **Continue: Flow E (Step 3).**

## Flow E: Step 3, connect Instagram and Facebook (Admin, Manager)

Entry: **From Flow D.** Node: **Step 3: Connect Instagram / Facebook (skippable).**

- **Skip** leads to **Mark step skipped**: Dashboard banner "Connect accounts".
- **Connect** leads to **Redirect to Meta OAuth** (state parameter for CSRF check), then:
  1. Decision **User grants all required permissions?**
     - no: **Show missing permissions**, Retry (back to OAuth) or Skip.
     - yes: decision **Eligible account?** (Instagram professional account, linked Facebook Page, user manages the Page).
       - no: **Explain requirements**, Retry or Skip.
       - yes: decision **Account already connected in this or another workspace?**
         - yes: **Block duplicate**, show which workspace owns it.
         - no: **Exchange code, encrypt tokens**, create `social_accounts` and `social_credentials`, sync profile, log activity.
  2. Decision **Connect another account?**
     - yes: back to OAuth.
     - no: **Continue: Flow F (Step 4).**
- Both **Skip** paths end at **Continue: Flow F (Step 4).**

## Flow F: Step 4 (Discord, optional) and Step 5 (completion)

Entry: **From Flow E.** Node: **Step 4: Connect Discord (optional).**

- **Skip** leads to **Mark step skipped**: Dashboard banner "Connect Discord", then Step 5.
- **Connect (Admin only)**: decision **User role is Admin?**
  - no: **"Only Admin can configure Discord. Ask an Admin."**
  - yes: **Discord OAuth: add bot to server**, then decision **Authorized with required scopes?**
    - no: **Show error**, Retry or Skip.
    - yes: **Save `discord_integrations`**, send test message, then **Select channels** (notifications, approvals, alerts), then **Link my Discord account** (save `discord_user_links`).
- **Step 5: Complete onboarding**: set `onboarding_completed_at`, show setup checklist, then **Dashboard (banners for skipped steps).**

## Specification table (11 actions)

Each action lists: Trigger, Permission, Validation, Frontend response, Backend operation, Database changes, Success, Failure, Next step.

### 1. Sign up
- **Trigger:** submit sign-up form
- **Permission:** public
- **Validation:** email format; password policy; email unique; rate limit per IP
- **Frontend:** inline field errors; submit button shows loading
- **Backend:** hash password; create user; create verification token; send email
- **DB:** `users` (is_active, email_verified_at null); verification token stored hashed
- **Success:** verify-email screen
- **Failure:** email exists shows Login link; 429 shows rate-limit message
- **Next:** verify email

### 2. Verify email
- **Trigger:** click email link
- **Permission:** public (token holder)
- **Validation:** token exists, unused, unexpired
- **Frontend:** success screen, then auto-login
- **Backend:** mark verified; create session
- **DB:** `users.email_verified_at`; `user_sessions` row
- **Success:** logged in
- **Failure:** expired link page with Resend (rate limited)
- **Next:** Flow D routing (or Flow C if invite token)

### 3. Login
- **Trigger:** submit login form
- **Permission:** public
- **Validation:** credentials match; email verified; account active; lockout check
- **Frontend:** generic error message; lockout notice after 5 failures
- **Backend:** verify hash; create access and refresh tokens
- **DB:** `user_sessions`; `users.last_login_at`; `activity_logs` on lockout
- **Success:** session created
- **Failure:** invalid credentials; unverified shows resend screen; locked shows retry later
- **Next:** Flow D routing

### 4. Forgot / reset password
- **Trigger:** submit email, then open reset link
- **Permission:** public
- **Validation:** reset requires token valid, unused, password policy met
- **Frontend:** always show a neutral confirmation (no account enumeration)
- **Backend:** send reset link (1 hour); on reset update hash and revoke sessions
- **DB:** `users.password_hash`; `user_sessions.revoked_at`
- **Success:** password changed, login page
- **Failure:** invalid or used token: request new link
- **Next:** login

### 5. Accept invitation
- **Trigger:** open invite link, then login or sign up
- **Permission:** invited email owner
- **Validation:** invite pending, unexpired, not revoked; logged-in email matches; workspace active
- **Frontend:** show workspace and role being joined; mismatch screen with "Switch account"
- **Backend:** transaction: add member, close invite
- **DB:** `workspace_members` (invited role); `invitations.status = accepted`, `accepted_at`; `activity_logs`
- **Success:** dashboard with role-based sidebar
- **Failure:** invalid, expired or mismatched invite page
- **Next:** dashboard

### 6. Create workspace (Step 1)
- **Trigger:** submit Step 1
- **Permission:** any verified user without a workspace
- **Validation:** name required; slug unique and URL-safe; timezone valid
- **Frontend:** inline errors; suggested alternative slug
- **Backend:** transaction: create workspace, owner membership Admin, seed `role_permissions`
- **DB:** `workspaces`; `workspace_members` (admin); `role_permissions` defaults; onboarding_step 2; `activity_logs`
- **Success:** Step 2
- **Failure:** slug taken or validation error; transaction rolled back
- **Next:** Step 2

### 7. Invite member (Step 2 and Team Management)
- **Trigger:** submit invite
- **Permission:** Admin: any role. Manager: Manager or Executive (configurable). Executive: not allowed
- **Validation:** valid email; not an existing member; no pending invite; role allowed for the inviter
- **Frontend:** row appears as Pending; "Add another" prompt
- **Backend:** create token (store hash); send email; 7-day expiry
- **DB:** `invitations`; `activity_logs`
- **Success:** invite email sent
- **Failure:** inline error (already member or pending invite); email send failure shows Resend
- **Next:** add another or next step

### 8. Connect Instagram / Facebook (Step 3)
- **Trigger:** click Connect, return from Meta OAuth
- **Permission:** Admin, Manager
- **Validation:** state parameter matches; all permissions granted; Instagram professional account linked to Facebook Page; not already connected
- **Frontend:** loading while exchanging code; account card with status
- **Backend:** exchange code; encrypt tokens; fetch profile; queue initial sync
- **DB:** `social_accounts`; `social_credentials` (encrypted); `activity_logs`
- **Success:** account listed as active
- **Failure:** permissions denied, ineligible account, duplicate: explain and Retry or Skip
- **Next:** connect another or Step 4

### 9. Connect Discord (Step 4)
- **Trigger:** click Connect Discord, return from Discord OAuth
- **Permission:** Admin only
- **Validation:** required scopes granted; Admin has manage rights on that server
- **Frontend:** channel picker; test message status
- **Backend:** store guild; send test message; save channel mapping
- **DB:** `discord_integrations`; `activity_logs`
- **Success:** bot connected
- **Failure:** scope denied or bot add failed: Retry or Skip
- **Next:** Link my Discord account

### 10. Link Discord user
- **Trigger:** click "Link my Discord account"
- **Permission:** any workspace member
- **Validation:** Discord identity verified via OAuth; Discord ID not linked to another member
- **Frontend:** linked badge with Discord username
- **Backend:** verify identity; store link
- **DB:** `discord_user_links`
- **Success:** slash commands usable by this user
- **Failure:** already linked or verification failed message
- **Next:** Step 5

### 11. Complete onboarding (Step 5)
- **Trigger:** click Finish or last step done
- **Permission:** Admin
- **Validation:** none (steps are skippable)
- **Frontend:** checklist with skipped steps; success state
- **Backend:** mark onboarding complete
- **DB:** `workspaces.onboarding_completed_at` (the board wrote "workspaces.settings or onboarding_completed_at"; use the dedicated column); `activity_logs`
- **Success:** dashboard
- **Failure:** save error: retry button
- **Next:** dashboard with banners for skipped steps

---

# PART 3: DECISIONS AND SCHEMA CHANGES REQUIRED

The boards reveal gaps versus the first `socialflow.dbml`. Apply these when creating the Prisma schema:

1. `workspaces`: add `onboarding_step` (int, default 1), `onboarding_completed_at` (timestamptz, nullable). Optional: `approval_required` (boolean, default true).
2. New table `auth_tokens`: id, user_id, type (`email_verification` | `password_reset`), token_hash (unique), expires_at, used_at, created_at.
3. `users`: add `failed_login_count` (int, default 0) and `locked_until` (timestamptz, nullable) for the 5-failure lockout.
4. **Decision on Board 2 Flow E:** a Meta account can belong to **one workspace only**. Enforce a global unique constraint on `(platform, platform_account_id)`. (The first DBML only enforced uniqueness inside a workspace.)
5. **Role rule on Board 2:** Admin can invite any role; Manager can invite Manager or Executive. This is the designer's assumption, kept configurable via `role_permissions`.

Numeric defaults used on the boards: login lockout after 5 failed attempts; reset link valid 1 hour; invitation valid 7 days; verification link expiry is not specified on the board (suggested: 24 hours).

# PART 4: NOT YET DESIGNED

Boards 3 to 10 are not created yet: role-based journeys, page-by-page workflows, content creation and publishing, approval workflow, AI smart scheduling, Discord integration, system architecture, and system states and edge cases. Where this document and a later board disagree, the later board wins.

# PART 5: HOW TO USE THIS WITH OPENCODE

Suggested instruction:

> Read `docs/socialflow-boards-1-2-spec.md` fully. Part 1 is the exact page list, navigation, role access and page-to-page links to build. Part 2 is the exact authentication, invitation and onboarding behavior, including every error branch. Part 3 lists database changes to apply before migrations. Implement pages and flows exactly as written. Do not invent extra pages. Enforce role access in the backend, not only in the UI.
