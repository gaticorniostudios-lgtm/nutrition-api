const express = require("express");
const multer = require("multer");
const path = require("path");
const { analyzeFood } = require("../controllers/analyze.controller");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const fileFilter = (req, file, cb) => {
  console.log("Archivo recibido en multer:", file);
  console.log("Mimetype:", file.mimetype);
  console.log("Original name:", file.originalname);

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMime = allowedMimeTypes.includes(file.mimetype);
  const isValidExt = allowedExtensions.includes(ext);

  if (isValidMime || isValidExt) {
    cb(null, true);
  } else {
    cb(new Error("El archivo debe ser una imagen v\u00e1lida: JPG, JPEG, PNG o WEBP"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post("/analyze-food", upload.single("image"), analyzeFood);

module.exports = router;
