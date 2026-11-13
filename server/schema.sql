-- 멍냥이의 버스여행 데이터베이스 (Cloudflare D1)

-- 사용자: 가입 없이 기기마다 자동으로 만들어지는 계정
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,        -- 기기에만 저장되는 비밀 열쇠
  code          TEXT NOT NULL UNIQUE,        -- 친구 코드 (예: MEOW-7K2P)
  nickname      TEXT NOT NULL DEFAULT '',
  unlocked      INTEGER NOT NULL DEFAULT 1,  -- 열린 단계
  hearts        INTEGER NOT NULL DEFAULT 5,
  hearts_t      INTEGER NOT NULL DEFAULT 0,
  full_at       INTEGER NOT NULL DEFAULT 0,  -- 하트가 가득 차는 시각 (0 = 이미 가득)
  full_notified INTEGER NOT NULL DEFAULT 1,  -- 가득 참 알림을 보냈는지
  push          TEXT,                        -- 웹 푸시 구독 정보 (JSON)
  backup_hash   TEXT,                        -- 백업 코드의 해시 (코드 자체는 저장하지 않아요)
  last_seen     INTEGER NOT NULL DEFAULT 0,  -- 마지막으로 게임에 들어온 시각
  reminded_at   INTEGER NOT NULL DEFAULT 0,  -- 마지막 여행 알림 시각 (하루 한 번)
  created       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_backup ON users(backup_hash);
CREATE INDEX IF NOT EXISTS users_full ON users(full_notified, full_at);

-- 친구 (양쪽 방향으로 한 줄씩). last_gift = a가 b에게 마지막으로 하트를 보낸 시각
CREATE TABLE IF NOT EXISTS friends (
  a          TEXT NOT NULL,
  b          TEXT NOT NULL,
  last_gift  INTEGER NOT NULL DEFAULT 0,
  created    INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);

-- 하트 선물
CREATE TABLE IF NOT EXISTS gifts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id  TEXT NOT NULL,
  to_id    TEXT NOT NULL,
  at       INTEGER NOT NULL,
  claimed  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gifts_to ON gifts(to_id, claimed);

-- 폰 알림에 띄울 메시지함
CREATE TABLE IF NOT EXISTS notes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL,
  title    TEXT NOT NULL,
  body     TEXT NOT NULL,
  at       INTEGER NOT NULL,
  seen     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS notes_user ON notes(user_id, seen);

-- 친구에게 보내는 쪽지 (대화가 아니라 우편함에 쌓이는 짧은 글)
CREATE TABLE IF NOT EXISTS letters (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id  TEXT NOT NULL,
  to_id    TEXT NOT NULL,
  body     TEXT NOT NULL,
  at       INTEGER NOT NULL,
  read     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS letters_to ON letters(to_id, read);
CREATE INDEX IF NOT EXISTS letters_from ON letters(from_id, at);
CREATE INDEX IF NOT EXISTS gifts_from ON gifts(from_id, at);

-- 너무 많이 두드리기 막기 (계정 만들기·백업 불러오기·친구 추가)
CREATE TABLE IF NOT EXISTS throttle (
  key    TEXT PRIMARY KEY,
  n      INTEGER NOT NULL,
  reset  INTEGER NOT NULL
);

-- 차단: a 가 b 를 차단했어요 (서로 친구 추가가 안 돼요)
CREATE TABLE IF NOT EXISTS blocks (
  a        TEXT NOT NULL,
  b        TEXT NOT NULL,
  created  INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);

-- 친구 요청 (닉네임으로 찾아서 보내고, 받은 사람이 수락해요)
CREATE TABLE IF NOT EXISTS friend_requests (
  from_id  TEXT NOT NULL,
  to_id    TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_id);

-- 전체 채팅 (사흘 지난 글은 지워요)
CREATE TABLE IF NOT EXISTS chat (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL,
  nickname TEXT NOT NULL,
  body     TEXT NOT NULL,
  at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_nick ON users(nickname);

-- 게임 오류 기록 (멈춤 원인 찾기용, 개인정보 없이 · 2주 뒤 삭제)
CREATE TABLE IF NOT EXISTS errors (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  ver    TEXT,
  level  INTEGER,
  msg    TEXT,
  stack  TEXT,
  ua     TEXT
);

-- 닉네임은 한 사람만 (대소문자 구분 없이, 빈 닉네임은 제외)
CREATE UNIQUE INDEX IF NOT EXISTS users_nick_unique ON users(lower(nickname)) WHERE nickname != '';

-- 공지사항 (개발자가 고칠 때마다 무엇이 바뀌었는지 올려요)
CREATE TABLE IF NOT EXISTS notices (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  title  TEXT NOT NULL,
  body   TEXT NOT NULL
);

-- 개발자에게 문의 (답이 달리면 reply 에 적고 폰 알림)
CREATE TABLE IF NOT EXISTS inquiries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  nickname    TEXT,
  body        TEXT NOT NULL,
  ver         TEXT,
  ua          TEXT,
  reply       TEXT,
  replied_at  INTEGER,
  status      TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS inquiries_user ON inquiries(user_id);
CREATE TABLE IF NOT EXISTS clears (user_id TEXT NOT NULL, level INTEGER NOT NULL, tries INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, level));
CREATE INDEX IF NOT EXISTS clears_level ON clears (level, tries, at);
ALTER TABLE users ADD COLUMN last_push INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN hide_seen INTEGER DEFAULT 0;
