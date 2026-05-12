import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

async function initTables() {
  const createAdminTable = `
    CREATE TABLE IF NOT EXISTS AdminMenejemenKesiswaan (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(100) NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      email      VARCHAR(150) UNIQUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  const createSiswaTable = `
    CREATE TABLE IF NOT EXISTS DataMenejemenSiswa (
      id           SERIAL PRIMARY KEY,
      nisn         VARCHAR(20) NOT NULL UNIQUE,
      nama_lengkap VARCHAR(200) NOT NULL,
      gender       VARCHAR(20) NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
      kelas        VARCHAR(20) NOT NULL,
      jurusan      VARCHAR(100) NOT NULL,
      no_tlpn      VARCHAR(20),
      foto_profil  TEXT,
      status       VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'pindah', 'lulus', 'nonaktif')),
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(createAdminTable);
    await pool.query(createSiswaTable);
    console.log("[DB] Tables initialized successfully");
  } catch (err) {
    console.error("[DB] Table initialization failed:", err.message);
    process.exit(1);
  }
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(path.join(__dirname, "src/assets")));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/auth", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

app.get("/siswa", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

app.get("/api/data/admin", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, created_at, updated_at FROM AdminMenejemenKesiswaan ORDER BY id ASC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/data/admin", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO AdminMenejemenKesiswaan (username, password, email)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, password, email || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Username atau email sudah digunakan" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/data/admin/:id", async (req, res) => {
  const { id } = req.params;
  const { username, password, email } = req.body;
  try {
    const result = await pool.query(
      `UPDATE AdminMenejemenKesiswaan
       SET username = COALESCE($1, username),
           password = COALESCE($2, password),
           email    = COALESCE($3, email),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, username, email, updated_at`,
      [username || null, password || null, email || null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Admin tidak ditemukan" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/data/admin/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM AdminMenejemenKesiswaan WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Admin tidak ditemukan" });
    }
    res.json({ success: true, message: "Admin berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/data/siswa", async (req, res) => {
  const { kelas, jurusan, status, search } = req.query;
  let query = "SELECT * FROM DataMenejemenSiswa WHERE 1=1";
  const params = [];
  let i = 1;

  if (kelas)   { query += ` AND kelas = $${i++}`;                     params.push(kelas); }
  if (jurusan) { query += ` AND jurusan = $${i++}`;                   params.push(jurusan); }
  if (status)  { query += ` AND status = $${i++}`;                    params.push(status); }
  if (search)  { query += ` AND nama_lengkap ILIKE $${i++}`;          params.push(`%${search}%`); }

  query += " ORDER BY created_at DESC";

  try {
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/data/siswa/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM DataMenejemenSiswa WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/data/siswa", async (req, res) => {
  const { nisn, nama_lengkap, gender, kelas, jurusan, no_tlpn, foto_profil, status } = req.body;
  if (!nisn || !nama_lengkap || !gender || !kelas || !jurusan) {
    return res.status(400).json({ success: false, message: "Field wajib: nisn, nama_lengkap, gender, kelas, jurusan" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO DataMenejemenSiswa (nisn, nama_lengkap, gender, kelas, jurusan, no_tlpn, foto_profil, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nisn, nama_lengkap, gender, kelas, jurusan, no_tlpn || null, foto_profil || null, status || "aktif"]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "NISN sudah terdaftar" });
    }
    if (err.code === "23514") {
      return res.status(400).json({ success: false, message: "Nilai gender atau status tidak valid" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/data/siswa/:id", async (req, res) => {
  const { id } = req.params;
  const { nisn, nama_lengkap, gender, kelas, jurusan, no_tlpn, foto_profil, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE DataMenejemenSiswa
       SET nisn         = COALESCE($1, nisn),
           nama_lengkap = COALESCE($2, nama_lengkap),
           gender       = COALESCE($3, gender),
           kelas        = COALESCE($4, kelas),
           jurusan      = COALESCE($5, jurusan),
           no_tlpn      = COALESCE($6, no_tlpn),
           foto_profil  = COALESCE($7, foto_profil),
           status       = COALESCE($8, status),
           updated_at   = NOW()
       WHERE id = $9
       RETURNING *`,
      [nisn || null, nama_lengkap || null, gender || null, kelas || null,
       jurusan || null, no_tlpn || null, foto_profil || null, status || null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/data/siswa/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM DataMenejemenSiswa WHERE id = $1 RETURNING id, nama_lengkap",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
    }
    res.json({ success: true, message: `Siswa ${result.rows[0].nama_lengkap} berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/admin", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi" });
  }
  try {
    const result = await pool.query(
      "SELECT id, username, email, created_at FROM AdminMenejemenKesiswaan WHERE username = $1 AND password = $2",
      [username, password]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, message: "Username atau password salah" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/siswa", async (req, res) => {
  const { nama_lengkap, nisn } = req.body;
  if (!nama_lengkap || !nisn) {
    return res.status(400).json({ success: false, message: "Nama lengkap dan NISN wajib diisi" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM DataMenejemenSiswa WHERE LOWER(nama_lengkap) = LOWER($1) AND nisn = $2",
      [nama_lengkap.trim(), nisn.trim()]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, message: "Nama lengkap atau NISN tidak sesuai" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route tidak ditemukan" });
});

async function startServer() {
  await initTables();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();