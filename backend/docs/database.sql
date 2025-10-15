-- 如果数据库存在，先删除数据库
DROP DATABASE IF EXISTS tattoo_db;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS tattoo_db;

-- 使用数据库
USE tattoo_db;

-- 创建 users 表（必须先创建，因为其他表会引用）
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50),
  email VARCHAR(100),
  passwordHash VARCHAR(255),
  avatarUrl VARCHAR(255),
  credits INT,
  role VARCHAR(20), -- admin/normal
  level VARCHAR(20), -- free/lite/pro
  refreshToken VARCHAR(255),
  balance DECIMAL(10,2),
  membershipExpiry DATETIME,
  resetPasswordToken VARCHAR(255),
  firstlogintAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建 styles 表 (更新版本)
CREATE TABLE styles (
  id VARCHAR(36) PRIMARY KEY,
  title JSON,                                -- 多语言标题 { "en": "Style Title", "zh": "样式标题" }
  prompt JSON,                               -- 多语言提示词 { "en": "Prompt text", "zh": "提示词文本" }
  imageUrl VARCHAR(500),                     -- 风格示例图片URL
  sortOrder INT DEFAULT 0,                   -- 排序字段，数字越小排序越靠前
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 添加索引以提高查询性能
  INDEX idx_sort_order (sortOrder)
);

-- 创建 ideas 表
CREATE TABLE ideas (
  id VARCHAR(36) PRIMARY KEY,
  title JSON,                                -- 多语言标题 { "en": "Idea Title", "zh": "创意标题" }
  prompt JSON,                               -- 多语言提示词 { "en": "Prompt text", "zh": "提示词文本" }
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建 categories 表
CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY,
  name JSON,                            -- 多语言显示名称 { "en": "Animals", "zh": "动物" }
  description JSON,                             -- 多语言描述 { "en": "description", "zh": "描述" }
  slug VARCHAR(255) NOT NULL UNIQUE,          -- URL友好的slug，name的小写，用_链接单词
  imageId VARCHAR(36),                         -- 封面的图片
  hotness INT DEFAULT 0,                        -- 热度值，范围 0-1000
  seoTitle JSON,                              -- 多语言SEO标题 {"en": "SEO Title", "zh": "SEO标题"}
  seoDesc JSON,                              -- 多语言SEO描述 {"en": "SEO Description", "zh": "SEO描述"}
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建 tags 表
CREATE TABLE tags (
  id VARCHAR(36) PRIMARY KEY,
  name JSON,                           -- 多语言显示名称 { "en": "Easy", "zh": "简单" }
  description JSON,                            -- 多语言描述 { "en": "description", "zh": "描述" }
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建 images 表（包含正确的外键约束）
CREATE TABLE images (
    id VARCHAR(36) PRIMARY KEY,                -- 主键
    name JSON,                                  
    slug VARCHAR(255) NOT NULL UNIQUE,          -- URL友好的slug
    tattooUrl VARCHAR(255),                    
    scourceUrl VARCHAR(255),                     
    title JSON,                                 -- 多语言标题 { "en": "title", "zh": "标题" }
    description JSON,                           -- 多语言描述 { "en": "description", "zh": "描述" }
    type VARCHAR(50),                           -- 图片类型：'text2image/image2image'
    styleId VARCHAR(36),                          
    isColor BOOLEAN,                            -- 是否彩色图片
    isPublic BOOLEAN DEFAULT FALSE,             -- 是否公开
    isOnline BOOLEAN DEFAULT FALSE,             -- 是否上线（审核通过且可在前端展示）
    hotness INT DEFAULT 0,                      -- 热度值，范围 0-1000
    prompt JSON,                                -- 多语言生成提示词 { "en": "prompt", "zh": "提示词" }
    batchId VARCHAR(36),                        -- 批次ID，用于标识一次生成的多张图片
    userId VARCHAR(36),                        -- 用户ID
    categoryId VARCHAR(36),                    -- 分类ID
    additionalInfo JSON,                        -- 额外信息
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- 外键约束
    CONSTRAINT fk_images_user
      FOREIGN KEY (userId) REFERENCES users(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_images_category
      FOREIGN KEY (categoryId) REFERENCES categories(id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_images_style
      FOREIGN KEY (styleId) REFERENCES styles(id)
      ON DELETE SET NULL ON UPDATE CASCADE
);

-- 更新 categories 表的外键约束（添加到 images 表创建后）
ALTER TABLE categories
ADD CONSTRAINT fk_categories_image
  FOREIGN KEY (imageId) REFERENCES images(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 创建 image_tags 关联表（多对多关系，替代images表中的tags JSON字段）
CREATE TABLE image_tags (
  imageId VARCHAR(36),                        -- 匹配images表主键类型
  tagId VARCHAR(36),
  PRIMARY KEY (imageId, tagId),
  -- 外键约束
  CONSTRAINT fk_image_tags_image
    FOREIGN KEY (imageId) REFERENCES images(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_image_tags_tag
    FOREIGN KEY (tagId) REFERENCES tags(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- 创建 recharges 表
CREATE TABLE recharges (
  id varchar(36) NOT NULL, -- 主键：充值记录的唯一标识 UUID
  userId varchar(36) NOT NULL, -- 外键：关联用户表中的 userId
  orderId varchar(50) DEFAULT NULL, -- PayPal 或其他支付渠道生成的订单号，可能为空（如系统赠送）
  amount decimal(10, 2) NOT NULL, -- 金额（单位：美元），系统赠送为 0
  currency char(3) NOT NULL DEFAULT 'USD', -- 货币代码，默认为 USD（美元）
  status enum('pending', 'success', 'failed', 'refund') NOT NULL, -- 状态：待支付、成功、失败、已退款
  method varchar(20) NOT NULL, -- 支付方式，如 'paypal'、'stripe'、'system'（系统赠送）
  planCode varchar(20) NOT NULL, -- 套餐代码，如 monthly_basic, yearly_pro 等
  creditsAdded int unsigned NOT NULL, -- 实际到账的积分数量
  chargeType enum('Monthly', 'Yearly', 'Credit') NOT NULL, -- 套餐类型：月付、年付、单次购买积分
  duration tinyint unsigned NOT NULL DEFAULT '0', -- 会籍时长（单位：月），仅 Yearly/Monthly 有效
  monthlyCredit int unsigned NOT NULL DEFAULT '0', -- 月度赠送积分（仅 Yearly 有效）
  gift_month char(7) NOT NULL DEFAULT '' COMMENT 'YYYY-MM；系统月赠幂等键', -- 标记赠送积分对应的月份，仅系统发放积分使用
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间（插入时自动记录）
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 更新时间（记录变动时自动刷新）

  -- 主键
  PRIMARY KEY (id),

  -- 唯一约束：防止同一用户在同一月份对同一类型的充值（例如系统月赠）重复入账
  UNIQUE KEY uq_user_month (userId, gift_month, chargeType),

  -- 唯一约束：防止同一支付订单号被重复写入
  UNIQUE KEY orderId (orderId),

  -- 普通索引：加速通过 userId 查询记录
  KEY idx_userId (userId),

  -- 普通索引：加速通过 chargeType 查询
  KEY idx_chargeType (chargeType),

  -- 外键约束：保证 userId 的合法性；若用户删除，相关充值记录也将被删除
  CONSTRAINT fk_recharges_user FOREIGN KEY (userId) REFERENCES users (id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
);

-- 创建 image_reports 表
CREATE TABLE image_reports (
  id VARCHAR(36) PRIMARY KEY,
  imageId VARCHAR(36),
  userId VARCHAR(36),
  content TEXT,
  report_type VARCHAR(50),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- 外键约束
  CONSTRAINT fk_image_reports_user
    FOREIGN KEY (userId) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_image_reports_image
    FOREIGN KEY (imageId) REFERENCES images(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);


-- 创建 posts 表（博客文章）
CREATE TABLE posts (
  id VARCHAR(36) PRIMARY KEY,
  title JSON NOT NULL,                        -- 多语言标题 { "en": "title", "zh": "标题" }
  slug VARCHAR(255) NOT NULL UNIQUE,          -- URL友好的slug
  author VARCHAR(255) NOT NULL,               -- 作者名称
  publishedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('draft', 'published') DEFAULT 'draft',
  featuredImageUrl VARCHAR(500),                -- 特色图片URL
  excerpt JSON,                               -- 多语言摘要 { "en": "excerpt", "zh": "摘要" }
  content JSON NOT NULL,                      -- 多语言富文本内容 { "en": "content", "zh": "内容" }
  metaTitle JSON,                            -- 多语言SEO标题 { "en": "meta title", "zh": "SEO标题" }
  metaDesc JSON,                      -- 多语言SEO描述 { "en": "meta description", "zh": "SEO描述" }
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建 prompt_templates 表（提示词模板）
CREATE TABLE prompt_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,                 -- 模板名称
  prompt TEXT,                           -- 模板描述
  isDefault BOOLEAN DEFAULT FALSE,            -- 是否为默认模板
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 添加索引
  INDEX idx_prompt_templates_is_default (isDefault),
  INDEX idx_prompt_templates_name (name)
);

-- ========================================
-- 性能优化索引
-- ========================================

-- users表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_users_membership_expiry ON users(membershipExpiry);

-- categories表索引
CREATE INDEX idx_categories_hotness ON categories(hotness DESC);

-- images表索引
CREATE INDEX idx_images_user_id ON images(userId);
CREATE INDEX idx_images_category_id ON images(categoryId);
CREATE INDEX idx_images_style_id ON images(styleId);
CREATE INDEX idx_images_hotness ON images(hotness DESC);
CREATE INDEX idx_images_is_public ON images(isPublic);
CREATE INDEX idx_images_is_online ON images(isOnline);
CREATE INDEX idx_images_is_color ON images(isColor);
CREATE INDEX idx_images_type ON images(type);
CREATE INDEX idx_images_created_at ON images(createdAt DESC);
-- 组合索引用于常见查询
CREATE INDEX idx_images_public_online ON images(isPublic, isOnline);
CREATE INDEX idx_images_category_hotness ON images(categoryId, hotness DESC);
CREATE INDEX idx_images_user_created ON images(userId, createdAt DESC);
CREATE INDEX idx_images_batch_id ON images(batchId);

-- image_reports表索引
CREATE INDEX idx_image_reports_image_id ON image_reports(imageId);
CREATE INDEX idx_image_reports_user_id ON image_reports(userId);
CREATE INDEX idx_image_reports_type ON image_reports(report_type);
CREATE INDEX idx_image_reports_created_at ON image_reports(createdAt DESC);

-- posts表索引
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published_at ON posts(publishedAt DESC);
CREATE INDEX idx_posts_author ON posts(author);
-- 组合索引用于发布文章查询
CREATE INDEX idx_posts_status_published ON posts(status, publishedAt DESC);