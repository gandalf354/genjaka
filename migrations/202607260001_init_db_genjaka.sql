CREATE DATABASE IF NOT EXISTS db_genjaka;
USE db_genjaka;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','teacher','admin','superadmin','ppg','pjp') NOT NULL DEFAULT 'user',
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  photo_url TEXT NULL,
  gender VARCHAR(30) NULL,
  birth_place VARCHAR(100) NULL,
  birth_date DATE NULL,
  address TEXT NULL,
  phone_number VARCHAR(30) NULL,
  guardian_name VARCHAR(150) NULL,
  mother_name VARCHAR(150) NULL,
  biography TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE attendances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('hadir','izin','sakit','alpa') NOT NULL,
  note TEXT NULL,
  marked_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendances_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_attendances_marker
    FOREIGN KEY (marked_by) REFERENCES users(id)
    ON DELETE RESTRICT,
  UNIQUE KEY uk_user_attendance_date (user_id, attendance_date)
);

CREATE TABLE registration_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  reviewed_by BIGINT UNSIGNED NOT NULL,
  decision ENUM('approved','rejected') NOT NULL,
  note TEXT NULL,
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_registration_reviews_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_registration_reviews_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE TABLE landing_page_contents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hero_title VARCHAR(200) NOT NULL,
  hero_subtitle TEXT NULL,
  hero_badge VARCHAR(150) NULL,
  hero_image_url TEXT NULL,
  vision_text TEXT NULL,
  mission_items JSON NULL,
  contact_address TEXT NULL,
  contact_phone VARCHAR(50) NULL,
  contact_email VARCHAR(150) NULL,
  instagram_url VARCHAR(255) NULL,
  facebook_url VARCHAR(255) NULL,
  tiktok_url VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE landing_page_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  image_url TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_landing_page_activities_content
    FOREIGN KEY (content_id) REFERENCES landing_page_contents(id)
    ON DELETE CASCADE
);

INSERT INTO users (full_name, email, password_hash, role, approval_status, is_active)
VALUES
  ('Super Admin Genjaka', 'superadmin@genjaka.local', '$2b$10$.MffQZSPKR.tA/pjUUySL.ZCHUgjtYPJ4ZE9rwLPJe5xCkR8t4.Ui', 'superadmin', 'approved', 1),
  ('Admin Operasional', 'admin@genjaka.local', '$2b$10$PRhhrGYKnLVA6dt.WQoYu.Ki3Ob4ww4Jsfk3xtIN8XoAmPDd7Cdy.', 'admin', 'approved', 1),
  ('Dewan Guru Utama', 'guru@genjaka.local', '$2b$10$jEWZi0a.WfqWiDdQfWBEK.6tcSU.paC6Tpj3TKXl74cSfgwS7Gl2O', 'teacher', 'approved', 1),
  ('Ahmad Fadli', 'user@genjaka.local', '$2b$10$0EqUzh8aWruuKejAAQvBUOMZ/dUc5qkBJINUGsPHo54GQnQ8BWpVO', 'user', 'approved', 1);

INSERT INTO landing_page_contents (
  hero_title,
  hero_subtitle,
  hero_badge,
  hero_image_url,
  vision_text,
  mission_items,
  contact_address,
  contact_phone,
  contact_email,
  instagram_url,
  facebook_url,
  tiktok_url
) VALUES (
  'Portal Genjaka untuk Profil Lembaga dan Administrasi Terpadu',
  'Landing page publik yang berkarakter, dipadukan dengan dashboard multi-role untuk registrasi, biodata, absensi, dan pengelolaan konten.',
  'Akademik Modern • Administrasi Terintegrasi',
  'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=modern%20educational%20institution%20facade%20at%20sunrise%2C%20elegant%20academic%20atmosphere%2C%20cinematic%20editorial%20photography%2C%20warm%20gold%20and%20deep%20blue%20palette%2C%20realistic%2C%20ultra%20detailed&image_size=landscape_16_9',
  'Menjadi lembaga yang tertib, unggul, dan hangat dalam membina generasi yang berakhlak, disiplin, dan siap berkembang.',
  JSON_ARRAY(
    'Menyediakan sistem registrasi dan pembinaan yang rapi, mudah dipantau, dan transparan.',
    'Mendorong budaya disiplin melalui pengelolaan absensi dan pelaporan yang terstruktur.',
    'Membangun komunikasi yang kuat antara peserta, guru, dan pengelola lembaga.'
  ),
  'Jl. Cendekia Utama No. 88, Yogyakarta',
  '0812-0000-1234',
  'info@genjaka.local',
  'https://instagram.com/genjaka.official',
  'https://facebook.com/genjaka.official',
  'https://tiktok.com/@genjaka.official'
);

INSERT INTO landing_page_activities (content_id, title, description, image_url, sort_order)
VALUES
  (
    1,
    'Pembinaan Karakter Pekanan',
    'Sesi terjadwal untuk memperkuat disiplin, adab, dan keteladanan peserta.',
    'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=students%20in%20a%20collaborative%20classroom%20workshop%2C%20academic%20uniforms%2C%20bright%20natural%20light%2C%20documentary%20photography%2C%20realistic%2C%20welcoming%20institution&image_size=landscape_16_9',
    1
  ),
  (
    1,
    'Pendampingan Dewan Guru',
    'Pendekatan personal untuk memantau perkembangan akademik dan perilaku peserta.',
    'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=school%20assembly%20and%20mentoring%20activity%20in%20a%20modern%20campus%20hall%2C%20structured%20formation%2C%20elegant%20lighting%2C%20realistic%20photography&image_size=landscape_16_9',
    2
  ),
  (
    1,
    'Kegiatan Sosial dan Kepemimpinan',
    'Ruang praktik nyata untuk melatih kolaborasi, tanggung jawab, dan kepedulian.',
    'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=teachers%20guiding%20students%20during%20community%20service%20event%2C%20outdoor%20courtyard%2C%20professional%20candid%20photography%2C%20realistic&image_size=landscape_16_9',
    3
  );
