const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const files = new Map(); // id -> { path, name, expiresAt, downloads }

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/* -------- UPLOAD -------- */

app.post("/upload", upload.single("file"), (req, res) => {
  const id = uuidv4();

  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

  files.set(id, {
    path: req.file.path,
    name: req.file.originalname,
    expiresAt,
    downloads: 0
  });

  // auto delete
  setTimeout(() => {
    const file = files.get(id);
    if (file) {
      fs.unlink(file.path, () => {});
      files.delete(id);
    }
  }, 10 * 60 * 1000);

  res.json({
    url: `https://codedrop-server.onrender.com/file/${id}`,
    expiresAt
  });
});

/* -------- DOWNLOAD -------- */

app.get("/file/:id", (req, res) => {
  const file = files.get(req.params.id);

  if (!file) return res.status(404).send("Not found");

  if (Date.now() > file.expiresAt) {
    return res.status(410).send("Expired");
  }

  file.downloads++;

  res.download(file.path, file.name);
});

/* -------- STATS -------- */

app.get("/stats/:id", (req, res) => {
  const file = files.get(req.params.id);
  if (!file) return res.status(404).json({});

  res.json({
    downloads: file.downloads,
    expiresAt: file.expiresAt
  });
});

/* -------- ERROR HANDLER -------- */

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File too large (max 10MB)"
    });
  }
  next(err);
});

app.listen(3000, () => console.log("Server running"));