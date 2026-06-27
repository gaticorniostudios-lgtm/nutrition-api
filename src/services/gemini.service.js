const fs = require("fs/promises");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const VALID_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// El prompt fuerza una salida JSON para poder automatizar el calculo posterior.
const FOOD_ANALYSIS_PROMPT = `Analiza esta imagen de comida. Identifica unicamente los alimentos visibles. Estima la porcion aproximada en gramos de cada alimento. No inventes alimentos. Si no estas seguro, baja el valor de confidence. Devuelve SOLO JSON valido con este formato:
{
  "foods": [
    {
      "name": "arroz blanco",
      "estimated_grams": 150,
      "confidence": 0.85,
      "notes": "porcion aproximada"
    }
  ]
}`;

const getMimeType = (filePath, originalname, mimetype) => {
  const normalizedMimeType = String(mimetype || "").toLowerCase();
  const originalExt = path.extname(originalname || "").toLowerCase();
  const filePathExt = path.extname(filePath || "").toLowerCase();
  const ext = originalExt || filePathExt;

  if (VALID_IMAGE_MIME_TYPES.includes(normalizedMimeType)) {
    return normalizedMimeType;
  }

  if (MIME_BY_EXTENSION[ext]) {
    return MIME_BY_EXTENSION[ext];
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }

  const error = new Error("No se pudo detectar un MIME de imagen valido para Gemini");
  error.statusCode = 400;
  throw error;
};

const extractJson = (text) => {
  // Gemini a veces envuelve JSON en bloques Markdown; esta limpieza lo hace tolerante.
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Gemini no devolvio JSON valido");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
};

const normalizeFoods = (foods) => {
  if (!Array.isArray(foods)) return [];

  return foods
    .filter((food) => food && food.name)
    .map((food) => ({
      name: String(food.name).trim(),
      estimated_grams: Math.max(Number(food.estimated_grams) || 0, 0),
      confidence: Math.min(Math.max(Number(food.confidence) || 0, 0), 1),
      notes: food.notes ? String(food.notes) : "",
    }));
};

const analyzeFoodImage = async (filePath, originalname, mimetype) => {
  if (
    !process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY === "TU_API_KEY" ||
    process.env.GEMINI_API_KEY === "MI_CLAVE_GEMINI"
  ) {
    console.error("Falta configurar GEMINI_API_KEY en el archivo .env");
    const error = new Error("Falta configurar GEMINI_API_KEY en .env");
    error.statusCode = 500;
    throw error;
  }

  try {
    const imageBuffer = await fs.readFile(filePath);
    const imageBase64 = imageBuffer.toString("base64");
    const detectedMimeType = getMimeType(filePath, originalname, mimetype);

    console.log("MIME original:", mimetype);
    console.log("Nombre original:", originalname);
    console.log("MIME enviado a Gemini:", detectedMimeType);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent([
      FOOD_ANALYSIS_PROMPT,
      {
        inlineData: {
          data: imageBase64,
          mimeType: detectedMimeType,
        },
      },
    ]);

    const responseText = result.response.text();
    const parsed = JSON.parse(extractJson(responseText));

    return normalizeFoods(parsed.foods);
  } catch (error) {
    if (error.statusCode) throw error;

    const geminiError = new Error(`Fallo el analisis con Gemini: ${error.message}`);
    geminiError.statusCode = 502;
    throw geminiError;
  }
};

module.exports = {
  analyzeFoodImage,
  getMimeType,
};
