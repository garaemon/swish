# **Swish: Personal RSS & Bookmark Manager — Full Design Document**

## **1\. Project Overview & Concept**

**Concept: "Unconscious capture, efficient consumption"**

Carry over what Matter and Feedly did well, while keeping only the
information that is signal — not noise — for *this* user, in a state that
is easy to process. Trim features to the minimum and focus on personal
information digestion (Inbox Zero).

### **Per-platform UX**

* **Mobile:** Use iOS Shortcuts and friends to post a shared URL directly
  to the API in the background. The app never has to open and there is no
  completion screen to wait on — that is the "Swish" feel: zero friction.
* **PC (Web / Bookmarklet):** From a locked-down work PC where browser
  extensions are forbidden, save with one click via a bookmarklet — no
  navigation. The Web UI is dedicated to consuming the inbox.
* **CLI:** Save instantly from a terminal with `swish add <URL>`.

## **2\. Tech Stack**

A modern stack picked so a solo developer can build "fast, cheap, and
easy to maintain."

* **Language:** TypeScript
* **Framework:** Next.js (App Router)
* **Infrastructure:** Vercel (background processing via `waitUntil`)
* **DB / Auth:** Cloudflare D1 (SQLite, via Drizzle ORM) + Better Auth
  (email + password). Originally Supabase (PostgreSQL, GoTrue Auth); migrated
  to keep the whole stack on Cloudflare.
* **AI:** Gemini API (default model: `gemini-3.1-flash-light`)
  * **BYOK (Bring Your Own Key):** the user supplies their own API key.
* **Scraping:** `@mozilla/readability`, `jsdom`

## **3\. Database Design**

> **Note:** the SQL below is the original Supabase/PostgreSQL design. The
> current source of truth is `apps/web/lib/db/schema.ts` (D1 / SQLite) with
> migrations in `apps/web/migrations`. D1 has no RLS, so every query filters
> by `user_id` in application code; `profiles` was replaced by Better Auth's
> `user` table, and the `handle_new_user` trigger by a Better Auth
> `databaseHooks.user.create.after` hook.

Originally: lean on Supabase (PostgreSQL) relational structure and RLS as
much as possible.

### **3.1 Table definitions**

**1. `profiles`** (linked to Supabase Auth)

| Column | Type | Description |
| :---- | :---- | :---- |
| `id` | UUID (PK) | User ID (same as Auth) |
| `email` | TEXT | Email address |
| `created_at` | TIMESTAMP | Created at |

**2. `user_settings`** (AI settings, BYOK)

| Column | Type | Description |
| :---- | :---- | :---- |
| `user_id` | UUID (PK) | User ID |
| `ai_provider` | TEXT | Default: `'gemini'` |
| `ai_model` | TEXT | Default: `'gemini-3.1-flash-light'` |
| `encrypted_api_key` | TEXT | API key encrypted on the application side |
| `ai_summary_language` | TEXT | Default: `'English'` |
| `ai_custom_prompt` | TEXT | User's custom prompt |

**3. `personal_access_tokens`** (PAT for external tools)

| Column | Type | Description |
| :---- | :---- | :---- |
| `id` | UUID (PK) | Token ID (matches the JWT's `jti`) |
| `user_id` | UUID | Owner user ID |
| `name` | TEXT | Display name (e.g. `"iOS Shortcuts"`) |
| `expires_at` | TIMESTAMP | Expiry |
| `last_used_at` | TIMESTAMP | Last-used timestamp |

**4. `items`** (content + status management)

| Column | Type | Description |
| :---- | :---- | :---- |
| `id` | UUID (PK) | Item ID |
| `user_id` | UUID | Owner user ID |
| `url` | TEXT | Article URL |
| `title` | TEXT | Page title |
| `content_text` | TEXT | Extracted body (via Readability) |
| `summary_short` | TEXT | [for the list view] 1–2 line AI summary |
| `summary_long` | TEXT | [for the detail view] bulleted AI summary |
| `process_status` | TEXT | Processing state (`'pending'`, `'processing'`, `'completed'`, `'failed'`) |
| `error_message` | TEXT | Error detail when processing failed |
| `source_type` | TEXT | Origin (`'bookmark'` or `'rss'`) |
| `is_read` | BOOLEAN | Read/archived flag. Default `FALSE` |

**5. `tags` & `item_tags`** (tag management)

* **`tags`**: `id`, `user_id`, `name`
* **`item_tags`**: `item_id`, `tag_id` (composite PK)

### **3.2 Full DDL / RLS / trigger SQL**

```sql
-- Tables
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_settings (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  ai_provider TEXT DEFAULT 'gemini',
  ai_model TEXT DEFAULT 'gemini-3.1-flash-light',
  encrypted_api_key TEXT,
  ai_summary_language TEXT DEFAULT 'English',
  ai_custom_prompt TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE personal_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  xml_url TEXT NOT NULL,
  site_url TEXT,
  title TEXT,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, xml_url)
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  content_text TEXT,
  summary_short TEXT,
  summary_long TEXT,
  process_status TEXT DEFAULT 'pending' CHECK (process_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('bookmark', 'rss')),
  feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, url)
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE item_tags (
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (item_id, tag_id)
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own tokens" ON personal_access_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own feeds" ON feeds FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own items" ON items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own item_tags" ON item_tags FOR ALL
USING (EXISTS (SELECT 1 FROM items WHERE items.id = item_tags.item_id AND items.user_id = auth.uid()));

-- Auth-linked trigger: on signup, auto-create the profile and the settings row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email);
  INSERT INTO public.user_settings (user_id) VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## **4\. API & Data-flow Design**

### **4.1 Authentication strategy (hybrid)**

* **Web UI:** Better Auth cookie session (originally Supabase).
* **External tools (iOS Shortcuts, CLI, bookmarklet):** JWT-based
  Personal Access Token (PAT) auth.
  * Sent as `Authorization: Bearer <JWT>`.
  * The API verifies the signature and expiry (`exp`) using
    `JWT_SECRET`.
  * The `jti` claim is matched against the `personal_access_tokens`
    table to confirm the token has not been revoked.

### **4.2 Core API: `POST /api/bookmarks` async flow**

**Goal:** never block the user's input UX (UI), and run the heavy AI
processing in the background.

1. **Receive the request:** accept a URL and a PAT. (Implement CORS so
   the bookmarklet is allowed.)
2. **Immediate DB insert (sync):** insert into `items` with
   `process_status: 'pending'`.
3. **Immediate response:** return `200 OK` to the client.
4. **Background processing (Vercel `waitUntil`):**
   * **Update status:** flip to `'processing'`.
   * **Scrape:** extract the body (`content_text`) with Readability.
   * **AI summarise:** decrypt `user_settings.encrypted_api_key` with
     the server-side master key.
   * **Compose the prompt:** combine the system instruction +
     `ai_custom_prompt` + output language (`ai_summary_language`) and
     request a JSON-formatted response.
   * **DB update:** persist `summary_short`, `summary_long`, and tags,
     then flip `process_status` to `'completed'`.
   * **Error handling:** on failure, set it to `'failed'` and record
     the error in `error_message`.

### **4.3 Endpoint list**

* `POST /api/bookmarks` — save a URL (async)
* `GET /api/items` — list items
* `POST /api/items/[id]/retry` — retry a failed summary
* `PUT /api/items/[id]/read` — mark an item read (archive)
* `GET`, `POST`, `DELETE /api/tokens` — manage PATs
* `GET`, `PUT /api/settings` — manage user settings & AI settings

## **5\. Web UI/UX & Feature Spec**

### **A. Onboarding**

* After signing in with Google, if no API key is configured, route the
  user to the Settings screen.

### **B. Dashboard (Inbox)**

* **Goal:** keep the inbox empty (Inbox Zero).
* **Display:** list format. Title, source, one-line summary
  (`summary_short`), status (in-progress spinner / failure icon).
* **Actions:**
  * The "+" button opens a modal for manually adding a URL.
  * The "read (check)" button removes the row from the list (archive).
  * The failure icon offers "retry".

### **C. Reading View (detail)**

* **Display:** detailed summary (`summary_long`) and the cleaned
  extracted body (`content_text`).
* **Actions:**
  * "Read aloud (play / stop)" via the browser-standard Web Speech API.
  * Add / edit tags.
  * "Open original article" link.

### **D. Settings**

* **AI settings:** provider, model, API-key input, output language,
  custom instructions.
* **PAT management & bookmarklet generation:**
  * Enter a purpose and issue a PAT.
  * As soon as the PAT is issued, a bookmarklet link named "Save to
    Swish" is rendered in the UI.
  * The user only has to drag-and-drop it onto the bookmarks bar to
    finish setting up the PC save flow.
  * A trash icon revokes the PAT.

## **6\. Implementation Roadmap**

* **Phase 1:** Set up Supabase (run DDL / RLS), initialise Next.js,
  implement Google login.
* **Phase 2:** Settings screen (API-key encryption, PAT issuance),
  async AI pipeline for `POST /api/bookmarks`.
* **Phase 3:** Dashboard (list view, status handling) and Reading View
  (read-aloud) implementation.
* **Phase 4:** Bookmarklet generation, iOS Shortcut setup, (later) RSS
  support.
