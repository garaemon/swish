# **Swish: パーソナルRSS & ブックマークマネージャー 完全設計書**

## **1\. プロジェクト概要・コンセプト**

**コンセプト：「入力は無意識、消費は効率的」**

MatterやFeedlyの良さを引き継ぎつつ、「自分にとってノイズのない、処理しやすい情報だけが溜まる・読める」状態を作る。機能は最小限に絞り、個人の情報消化（Inbox Zero）に特化する。

### **プラットフォーム別 UX**

* **スマホ (Mobile):** iOSショートカット等を使用し、共有されたURLをバックグラウンドで直接APIに送信。アプリが開いたり完了画面で止まる「摩擦」をゼロにする（Swish体験）。  
* **PC (Web / ブックマークレット):** 拡張機能が入れられない会社PC等からも、ブックマークレットで1クリック保存（画面遷移なし）。Web UIは未読の消化に特化。  
* **CLI:** ターミナルから swish add \<URL\> で即座に保存。

## **2\. 技術スタック**

個人開発で「早く・安く・メンテしやすく」作るためのモダン構成。

* **言語:** TypeScript  
* **フレームワーク:** Next.js (App Router)  
* **インフラ:** Vercel (バックグラウンド処理の waitUntil 活用)  
* **BaaS (DB / Auth):** Supabase (PostgreSQL, GoTrue Auth)  
* **AI:** Gemini API (デフォルトモデル: gemini-3.1-flash-light)  
  * **BYOK (Bring Your Own Key) 方式:** ユーザー自身がAPIキーを設定する。  
* **スクレイピング:** @mozilla/readability, jsdom

## **3\. データベース設計**

Supabase (PostgreSQL) のリレーショナル構造と RLS を最大限に活用する。

### **3.1 テーブル定義**

**1\. profiles** (Supabase Auth連動)

| カラム名 | データ型 | 説明 |
| :---- | :---- | :---- |
| id | UUID (PK) | ユーザーID (Authと同一) |
| email | TEXT | メールアドレス |
| created\_at | TIMESTAMP | 作成日時 |

**2\. user\_settings** (AI設定・BYOK)

| カラム名 | データ型 | 説明 |
| :---- | :---- | :---- |
| user\_id | UUID (PK) | ユーザーID |
| ai\_provider | TEXT | デフォルト: 'gemini' |
| ai\_model | TEXT | デフォルト: 'gemini-3.1-flash-light' |
| encrypted\_api\_key | TEXT | アプリ側で暗号化されたAPIキー |
| ai\_summary\_language | TEXT | デフォルト: 'Japanese' |
| ai\_custom\_prompt | TEXT | ユーザーのカスタムプロンプト |

**3\. personal\_access\_tokens** (外部ツール認証用 PAT)

| カラム名 | データ型 | 説明 |
| :---- | :---- | :---- |
| id | UUID (PK) | トークンID (JWTの jti と一致) |
| user\_id | UUID | 所有ユーザーID |
| name | TEXT | 識別名 (例: "iOS Shortcuts") |
| expires\_at | TIMESTAMP | 有効期限 |
| last\_used\_at | TIMESTAMP | 最終利用日時 |

**4\. items** (コンテンツ本体・ステータス管理)

| カラム名 | データ型 | 説明 |
| :---- | :---- | :---- |
| id | UUID (PK) | アイテムID |
| user\_id | UUID | 所有ユーザーID |
| url | TEXT | 記事URL |
| title | TEXT | ページタイトル |
| content\_text | TEXT | 抽出された本文 (Readability) |
| summary\_short | TEXT | 【リスト用】AIによる1〜2行要約 |
| summary\_long | TEXT | 【詳細用】AIによる箇条書き詳細要約 |
| process\_status | TEXT | 処理状態 ('pending', 'processing', 'completed', 'failed') |
| error\_message | TEXT | 処理失敗時のエラー内容 |
| source\_type | TEXT | 出所 ('bookmark' または 'rss') |
| is\_read | BOOLEAN | 既読(アーカイブ)フラグ。デフォルト FALSE |

**5\. tags & item\_tags** (タグ管理)

* **tags:** id, user\_id, name  
* **item\_tags:** item\_id, tag\_id (複合PK)

### **3.2 DDL・RLS・トリガーの完全なSQLスクリプト**

\-- テーブル作成  
CREATE TABLE profiles (  
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,  
  email TEXT,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

CREATE TABLE user\_settings (  
  user\_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,  
  ai\_provider TEXT DEFAULT 'gemini',  
  ai\_model TEXT DEFAULT 'gemini-3.1-flash-light',  
  encrypted\_api\_key TEXT,  
  ai\_summary\_language TEXT DEFAULT 'Japanese',  
  ai\_custom\_prompt TEXT,  
  updated\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

CREATE TABLE personal\_access\_tokens (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,  
  name TEXT NOT NULL,  
  expires\_at TIMESTAMP WITH TIME ZONE,  
  last\_used\_at TIMESTAMP WITH TIME ZONE,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

CREATE TABLE feeds (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,  
  xml\_url TEXT NOT NULL,  
  site\_url TEXT,  
  title TEXT,  
  last\_fetched\_at TIMESTAMP WITH TIME ZONE,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  UNIQUE(user\_id, xml\_url)  
);

CREATE TABLE items (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,  
  url TEXT NOT NULL,  
  title TEXT,  
  content\_text TEXT,  
  summary\_short TEXT,  
  summary\_long TEXT,  
  process\_status TEXT DEFAULT 'pending' CHECK (process\_status IN ('pending', 'processing', 'completed', 'failed')),  
  error\_message TEXT,  
  source\_type TEXT NOT NULL CHECK (source\_type IN ('bookmark', 'rss')),  
  feed\_id UUID REFERENCES feeds(id) ON DELETE SET NULL,  
  is\_read BOOLEAN DEFAULT FALSE,  
  is\_archived BOOLEAN DEFAULT FALSE,  
  saved\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  UNIQUE(user\_id, url)  
);

CREATE TABLE tags (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  user\_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,  
  name TEXT NOT NULL,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  UNIQUE(user\_id, name)  
);

CREATE TABLE item\_tags (  
  item\_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,  
  tag\_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,  
  PRIMARY KEY (item\_id, tag\_id)  
);

\-- RLS (Row Level Security) 設定  
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;  
ALTER TABLE user\_settings ENABLE ROW LEVEL SECURITY;  
ALTER TABLE personal\_access\_tokens ENABLE ROW LEVEL SECURITY;  
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;  
ALTER TABLE items ENABLE ROW LEVEL SECURITY;  
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;  
ALTER TABLE item\_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() \= id);  
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() \= id);  
CREATE POLICY "Users can manage own settings" ON user\_settings FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users can manage own tokens" ON personal\_access\_tokens FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users can manage own feeds" ON feeds FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users can manage own items" ON items FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (auth.uid() \= user\_id);  
CREATE POLICY "Users can manage own item\_tags" ON item\_tags FOR ALL   
USING (EXISTS (SELECT 1 FROM items WHERE items.id \= item\_tags.item\_id AND items.user\_id \= auth.uid()));

\-- Auth連動トリガー (新規登録時にプロフィールと設定を自動生成)  
CREATE OR REPLACE FUNCTION public.handle\_new\_user()  
RETURNS trigger AS $$  
BEGIN  
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email);  
  INSERT INTO public.user\_settings (user\_id) VALUES (new.id);  
  RETURN new;  
END;  
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on\_auth\_user\_created  
  AFTER INSERT ON auth.users  
  FOR EACH ROW EXECUTE PROCEDURE public.handle\_new\_user();

## **4\. API & データフロー設計**

### **4.1 認証戦略 (ハイブリッド)**

* **Web UI:** Supabase標準のCookieセッション。  
* **外部ツール (iOS Shortcuts, CLI, ブックマークレット):** JWTベースの Personal Access Token (PAT) 認証。  
  * Authorization: Bearer \<JWT\> で送信。  
  * API側で JWT\_SECRET を用いて署名と期限(exp)を検証。  
  * DBの personal\_access\_tokens テーブルで jti を照合し、失効（Revoke）されていないか確認。

### **4.2 コアAPI: POST /api/bookmarks の非同期フロー**

**目的:** ユーザーの入力体験(UX)をブロックせず、重いAI処理を裏側で行う。

1. **リクエスト受信:** URLとPATを受け取る。(※CORS対応を実装しブックマークレットを許可)  
2. **即時DB登録 (同期):** URLを items に INSERT (process\_status: 'pending').  
3. **即時応答:** 200 OK をクライアントへ返却。  
4. **バックグラウンド処理 (Vercel waitUntil):**  
   * **ステータス更新:** 'processing' へ。  
   * **スクレイピング:** Readability で本文(content\_text)抽出。  
   * **AI要約:** サーバー側のマスターキーで user\_settings.encrypted\_api\_key を復号。  
   * **プロンプト合成:** 「システム命令 \+ ai\_custom\_prompt \+ 出力言語(ai\_summary\_language)」を合成し、JSONフォーマットでリクエスト。  
   * **DB更新:** summary\_short, summary\_long, tags を保存し、process\_status を 'completed' へ。  
   * **エラー処理:** 失敗時は 'failed' にし、error\_message を記録。

### **4.3 エンドポイント一覧**

* POST /api/bookmarks: URL保存 (非同期)  
* GET /api/items: アイテム一覧取得  
* POST /api/items/\[id\]/retry: 失敗した要約の再試行  
* PUT /api/items/\[id\]/read: アイテムの既読化(アーカイブ)  
* GET, POST, DELETE /api/tokens: PATの管理  
* GET, PUT /api/settings: ユーザー設定・AI設定の管理

## **5\. Web UI/UX・機能仕様**

### **A. オンボーディング**

* Googleログイン後、APIキーが未設定の場合はSettings画面へ誘導する。

### **B. ダッシュボード (Inbox)**

* **目的:** 受信箱を空にする (Inbox Zero)。  
* **表示:** リスト形式。タイトル、ソース、1行要約(summary\_short)、ステータス（処理中スピナー/失敗アイコン）。  
* **操作:**  
  * 「＋」ボタンでURL手動追加モーダル。  
  * 「既読（チェック）」ボタンでリストから消す（アーカイブ）。  
  * 失敗アイコンから「再試行」をクリック。

### **C. リーディングビュー (詳細)**

* **表示:** 詳細要約(summary\_long)と抽出されたクリーンな本文(content\_text)。  
* **操作:**  
  * ブラウザ標準のWeb Speech APIによる「音声読み上げ（再生/停止）」。  
  * タグの追加・編集。  
  * 「元記事を開く」リンク。

### **D. 設定画面 (Settings)**

* **AI設定:** プロバイダ、モデル、APIキー入力、出力言語、カスタム指示。  
* **PAT管理 & ブックマークレット生成:**  
  * 用途を入力してPATを発行。  
  * 発行と同時に「Swishへ保存」という名前のブックマークレット用リンクがUI上に生成される。  
  * ユーザーはこれをブックマークバーにドラッグ＆ドロップするだけでPC用の保存環境が完成する。  
  * ゴミ箱アイコンでPATを無効化。

## **6\. 実装ロードマップ**

* **Phase 1:** Supabase構築（DDL/RLS実行）、Next.js初期化、Googleログイン実装。  
* **Phase 2:** Settings画面（APIキー暗号化、PAT発行）、API(POST /api/bookmarks)の非同期・AIパイプライン実装。  
* **Phase 3:** Dashboard（リスト表示、ステータス管理）とReading View（音声読み上げ）の実装。  
* **Phase 4:** ブックマークレット生成、iOSショートカット設定、(将来的に) RSS対応。