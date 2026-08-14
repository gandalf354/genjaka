CREATE TABLE IF NOT EXISTS study_attendance_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NULL,
  supervisor1_id BIGINT UNSIGNED NOT NULL,
  supervisor2_id BIGINT UNSIGNED NULL,
  supervisor3_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_study_attendance_sessions_schedule
    FOREIGN KEY (schedule_id) REFERENCES study_schedules(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_attendance_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('hadir', 'izin', 'sakit', 'alpa') NOT NULL DEFAULT 'alpa',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_study_attendance_entries_session
    FOREIGN KEY (session_id) REFERENCES study_attendance_sessions(id)
    ON DELETE CASCADE
);
