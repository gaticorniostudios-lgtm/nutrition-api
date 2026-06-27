const fs = require("fs/promises");
const { analyzeFoodImage } = require("../services/gemini.service");
const { searchFoodNutrition } = require("../services/usda.service");
const {
  calculateNutritionForPortion,
  findLocalNutrition,
  sumNutritionTotals,
} = require("../utils/nutritionCalculator");

const deleteTemporaryFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.warn("No se pudo eliminar la imagen temporal:", error.message);
  }
};

const analyzeFood = async (req, res) => {
  console.log("REQ FILE:", req.file);

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No se recibi\u00f3 ninguna imagen. Usa form-data con el campo image.",
    });
  }

  try {
    const detectedFoods = await analyzeFoodImage(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    if (!detectedFoods.length) {
      return res.status(422).json({
        success: false,
        error: "No se detectaron alimentos visibles en la imagen",
      });
    }

    const foods = await Promise.all(
      detectedFoods.map(async (food) => {
        const estimatedGrams = Number(food.estimated_grams) || 0;
        const localNutrition = findLocalNutrition(food.name);

        if (localNutrition) {
          return {
            name: food.name,
            estimated_grams: estimatedGrams,
            ...calculateNutritionForPortion(localNutrition, estimatedGrams),
            confidence: Number(food.confidence) || 0,
            notes: "Estimado con tabla nutricional local",
            source: "local",
          };
        }

        // Cada alimento se maneja de forma aislada para que un fallo de USDA no rompa todo el endpoint.
        const nutrition = await searchFoodNutrition(food.name);

        if (!nutrition.found) {
          return {
            name: food.name,
            estimated_grams: estimatedGrams,
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
            confidence: Number(food.confidence) || 0,
            notes: nutrition.reason || "No se pudo consultar USDA",
            source: "USDA",
          };
        }

        return {
          name: food.name,
          estimated_grams: estimatedGrams,
          ...calculateNutritionForPortion(nutrition, estimatedGrams),
          confidence: Number(food.confidence) || 0,
          notes: food.notes || "",
          source: "USDA",
        };
      })
    );

    res.json({
      success: true,
      foods,
      totals: sumNutritionTotals(foods),
      warning: "Las calorias son aproximadas. Para mayor precision, confirma el peso o la porcion.",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || "No se pudo analizar la imagen",
    });
  } finally {
    await deleteTemporaryFile(req.file.path);
  }
};

module.exports = {
  analyzeFood,
};
