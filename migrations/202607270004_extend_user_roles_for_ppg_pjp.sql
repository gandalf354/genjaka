ALTER TABLE users
MODIFY COLUMN role ENUM('user','teacher','admin','superadmin','ppg','pjp') NOT NULL DEFAULT 'user';
