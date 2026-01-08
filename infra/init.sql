SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 確保在正確 DB
CREATE DATABASE IF NOT EXISTS ai_advisor
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ai_advisor;

-- 1) 使用者
CREATE TABLE IF NOT EXISTS USRINFO (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  userid          VARCHAR(64)  NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  role            ENUM('user','admin') NOT NULL DEFAULT 'user',

  -- SAP 連線相關（新結構）
  sapconn         VARCHAR(50)   NULL,  -- 連線說明/別名（例如 PRD-ACME）
  sapaddr         VARCHAR(64)   NULL,  -- 主機 IP / 名稱（例如 10.1.2.3）
  sapins          CHAR(2)       NULL,  -- 事例號碼（Instance / SYSNR，例：00）
  sapid           CHAR(3)       NULL,  -- 系統 ID（SID，例：PRD）
  sapclnt         CHAR(3)       NULL,  -- Client（例：100）
  saprouter       VARCHAR(255)  NULL,  -- SAP Router string（可為空）
  sapusr          VARCHAR(40)   NULL,  -- ECC 連線 user
  sappw           VARCHAR(255)  NULL,  -- ECC 連線密碼

  points_balance      INT UNSIGNED NOT NULL DEFAULT 0,
  points_updated_at   TIMESTAMP NULL,

  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX ix_usr_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 種子（測試）
INSERT IGNORE INTO USRINFO (userid, password, role)
VALUES ('admin','admin123','admin');

INSERT IGNORE INTO USRINFO
  (userid, password, role,
   sapconn, sapaddr, sapins, sapid, sapclnt, saprouter, sapusr, sappw,
   points_balance, points_updated_at)
VALUES
  ('test_user','user123','user',
   'PRD-ACME','10.0.0.1','00','PRD','100','', 'TECH_AI','secret123',
   5, NOW());

-- 2) 點數流水帳
CREATE TABLE IF NOT EXISTS points_ledger (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT NOT NULL,
  kind           ENUM('DEBIT','CREDIT','REFUND') NOT NULL,
  amount         INT UNSIGNED NOT NULL,
  balance_after  INT UNSIGNED NOT NULL,
  note           VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_pl_user_time (user_id, created_at),
  CONSTRAINT fk_pl_user FOREIGN KEY (user_id)
    REFERENCES USRINFO(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) RFC 結果表：ZPRDVERS
CREATE TABLE IF NOT EXISTS ZPRDVERS (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id  BIGINT NOT NULL,
  batch_id       CHAR(36) NOT NULL,
  BORM_ID        VARCHAR(20)  NOT NULL,
  BORM_NAME      VARCHAR(30)  NULL,
  BORM_VERS      VARCHAR(30)  NULL,
  BORM_VEND      VARCHAR(30)  NULL,
  BORM_NAME1     VARCHAR(72)  NULL,
  INSTSTATE      CHAR(1)      NULL,
  MOD_DATE       DATE         NULL,
  MOD_TIME       TIME         NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     TIMESTAMP NULL,
  INDEX ix_prd_user  (owner_user_id),
  INDEX ix_prd_batch (batch_id),
  INDEX ix_prd_exp   (expires_at),
  CONSTRAINT fk_prd_user FOREIGN KEY (owner_user_id)
    REFERENCES USRINFO(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) RFC 結果表：ZCVERS（`RELEASE` 需反引號）
CREATE TABLE IF NOT EXISTS ZCVERS (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id  BIGINT NOT NULL,
  batch_id       CHAR(36) NOT NULL,
  COMPONENT      VARCHAR(30) NOT NULL,
  `RELEASE`      VARCHAR(10) NULL,
  EXTRELEASE     VARCHAR(10) NULL,
  COMP_TYPE      CHAR(1)     NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     TIMESTAMP NULL,
  INDEX ix_cv_user  (owner_user_id),
  INDEX ix_cv_batch (batch_id),
  INDEX ix_cv_exp   (expires_at),
  CONSTRAINT fk_cv_user FOREIGN KEY (owner_user_id)
    REFERENCES USRINFO(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) 初始化點數記帳（把有初始點數的 user 記一筆 CREDIT）
INSERT INTO points_ledger (user_id, kind, amount, balance_after, note)
SELECT id, 'CREDIT', points_balance, points_balance, 'initial grant'
FROM USRINFO
WHERE role='user' AND points_balance > 0;