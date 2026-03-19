const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());

const UPLOAD_DIR = path.join(__dirname, "uploads");

// ensure folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// storage config
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  },
});

const upload = multer({ storage });

// store metadata (in-memory for now)
const files = new Map();

/* ---------------- UPLOAD ---------------- */

app.post("/upload", upload.single("file"), (req, res) => {
  const id = path.parse(req.file.filename).name;

  const expireAt = Date.now() + 10 * 60 * 1000; // 10 min

  files.set(id, {
    path: req.file.path,
    originalName: req.file.originalname,
    expireAt,
  });

  const baseUrl = `${req.protocol}://${req.get("host")}`;

res.json({
  url: `${baseUrl}/file/${id}`
});
});

/* ---------------- DOWNLOAD ---------------- */

app.get("/file/:id", (req, res) => {
  const file = files.get(req.params.id);

  if (!file) return res.status(404).send("Not found");

  if (file.expireAt < Date.now()) {
    return res.status(410).send("Expired");
  }

  res.download(file.path, file.originalName);
});

/* ---------------- CLEANUP ---------------- */

// delete expired files every minute
setInterval(() => {
  const now = Date.now();

  for (const [id, file] of files.entries()) {
    if (file.expireAt < now) {
      try {
        fs.unlinkSync(file.path);
      } catch {}

      files.delete(id);
    }
  }
}, 60 * 1000);

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});