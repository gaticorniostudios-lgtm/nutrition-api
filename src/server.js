const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const analyzeRoutes = require("./routes/analyze.routes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS permite consumir la API desde Flutter Web, apps moviles o frontends externos.
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Nutrition API funcionando",
  });
});

app.use("/api", analyzeRoutes);

app.use((err, req, res, next) => {
  if (err.message === "El archivo debe ser una imagen v\u00e1lida: JPG, JPEG, PNG o WEBP") {
    return res.status(400).json({
      success: false,
      error: "El archivo debe ser una imagen v\u00e1lida: JPG, JPEG, PNG o WEBP",
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "La imagen no debe superar 5 MB",
    });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
  });
});

app.listen(PORT, () => {
  console.log(`Nutrition API running on port ${PORT}`);
});
