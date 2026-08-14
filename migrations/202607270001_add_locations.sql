CREATE TABLE IF NOT EXISTS villages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS village_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  village_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_village_groups_village
    FOREIGN KEY (village_id) REFERENCES villages(id)
    ON DELETE CASCADE
);

INSERT INTO villages (id, name)
SELECT 1, 'Desa Karangrejo'
WHERE NOT EXISTS (SELECT 1 FROM villages WHERE id = 1);

INSERT INTO villages (id, name)
SELECT 2, 'Desa Sukamaju'
WHERE NOT EXISTS (SELECT 1 FROM villages WHERE id = 2);

INSERT INTO village_groups (id, village_id, name)
SELECT 1, 1, 'Kelompok An-Nur'
WHERE NOT EXISTS (SELECT 1 FROM village_groups WHERE id = 1);

INSERT INTO village_groups (id, village_id, name)
SELECT 2, 1, 'Kelompok Al-Falah'
WHERE NOT EXISTS (SELECT 1 FROM village_groups WHERE id = 2);

INSERT INTO village_groups (id, village_id, name)
SELECT 3, 2, 'Kelompok Ar-Rahmah'
WHERE NOT EXISTS (SELECT 1 FROM village_groups WHERE id = 3);
