const axios = require("axios");
const { normalizeFoodName } = require("../utils/normalizeFoodName");

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const PREFERRED_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

// Traducciones simples para mejorar coincidencias en USDA, que funciona mejor en ingles.
const foodTranslations = {
  pan: "bread",
  "pan de sandwich": "sandwich bread",
  "pan de s\u00e1ndwich": "sandwich bread",
  "pan con pollo": "chicken sandwich",
  pollo: "chicken cooked",
  "pollo desmenuzado": "chicken breast cooked",
  "pechuga de pollo": "chicken breast cooked",
  arroz: "white rice cooked",
  "arroz blanco": "white rice cooked",
  papa: "potato boiled",
  "papas paja": "potato chips",
  "papas fritas": "french fries",
  "salsa cremosa": "mayonnaise",
  mayonesa: "mayonnaise",
  lechuga: "lettuce raw",
  tomate: "tomato raw",
  carne: "beef cooked",
  huevo: "egg whole cooked",
  queso: "cheese",
  atun: "tuna canned",
  "at\u00fan": "tuna canned",
  platano: "banana raw",
  "pl\u00e1tano": "banana raw",
  manzana: "apple raw",
  yogurt: "yogurt plain",
  leche: "milk whole",
};

const translateFoodName = (foodName) => {
  const normalizedName = normalizeFoodName(foodName);
  return foodTranslations[normalizedName] || foodName;
};

const getNutrientValue = (foodNutrients, matcher) => {
  const nutrient = foodNutrients.find((item) => {
    const nutrientName = normalizeFoodName(item.nutrientName);
    const unitName = String(item.unitName || "").toUpperCase();
    return matcher(nutrientName, unitName);
  });

  const value = Number(nutrient?.value);
  return Number.isFinite(value) ? value : null;
};

const extractNutrients = (food) => {
  const foodNutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];

  return {
    caloriesPer100g: getNutrientValue(
      foodNutrients,
      (name, unit) => name.includes("energy") && unit === "KCAL"
    ),
    proteinPer100g: getNutrientValue(
      foodNutrients,
      (name) => name.includes("protein")
    ),
    carbsPer100g: getNutrientValue(
      foodNutrients,
      (name) => name.includes("carbohydrate, by difference") || name.includes("carbohydrate")
    ),
    fatPer100g: getNutrientValue(
      foodNutrients,
      (name) => name.includes("total lipid (fat)") || name.includes("total lipid") || name.includes("total fat")
    ),
  };
};

const isPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isValidNumber = (value) => typeof value === "number" && Number.isFinite(value);

const scoreFoodResult = (food, searchName) => {
  const description = normalizeFoodName(food.description);
  const normalizedSearchName = normalizeFoodName(searchName);
  const searchWords = normalizedSearchName.split(/\s+/).filter(Boolean);
  const nutrients = extractNutrients(food);
  let score = 0;

  if (description === normalizedSearchName) score += 40;
  if (description.includes(normalizedSearchName)) score += 25;

  const matchedWords = searchWords.filter((word) => description.includes(word)).length;
  score += matchedWords * 8;

  if (isPositiveNumber(nutrients.caloriesPer100g)) score += 30;
  if (isPositiveNumber(nutrients.proteinPer100g)) score += 8;
  if (isPositiveNumber(nutrients.carbsPer100g)) score += 8;
  if (isPositiveNumber(nutrients.fatPer100g)) score += 8;

  const validMacroCount = [
    nutrients.proteinPer100g,
    nutrients.carbsPer100g,
    nutrients.fatPer100g,
  ].filter(isValidNumber).length;
  score += validMacroCount * 5;

  if (PREFERRED_DATA_TYPES.includes(food.dataType)) score += 12;

  const zeroCount = [
    nutrients.caloriesPer100g,
    nutrients.proteinPer100g,
    nutrients.carbsPer100g,
    nutrients.fatPer100g,
  ].filter((value) => value === 0 || value === null).length;
  score -= zeroCount * 8;

  return score;
};

const selectBestFood = (foods, searchName) => {
  return foods
    .map((food) => ({
      food,
      nutrients: extractNutrients(food),
      score: scoreFoodResult(food, searchName),
    }))
    .filter((candidate) => isPositiveNumber(candidate.nutrients.caloriesPer100g))
    .sort((a, b) => b.score - a.score)[0];
};

const searchFoodNutrition = async (foodName) => {
  const originalFoodName = String(foodName || "").trim();

  if (!originalFoodName) {
    return {
      found: false,
      reason: "Nombre de alimento vac\u00edo",
    };
  }

  if (
    !process.env.USDA_API_KEY ||
    process.env.USDA_API_KEY === "TU_API_KEY" ||
    process.env.USDA_API_KEY === "MI_CLAVE_USDA"
  ) {
    throw new Error("Falta USDA_API_KEY en .env");
  }

  const searchName = translateFoodName(originalFoodName);

  console.log("USDA search:", originalFoodName, "=>", searchName);

  try {
    const response = await axios.get(USDA_SEARCH_URL, {
      params: {
        query: searchName,
        api_key: process.env.USDA_API_KEY,
        pageSize: 5,
        dataType: PREFERRED_DATA_TYPES,
      },
      paramsSerializer: {
        indexes: null,
      },
      timeout: 10000,
    });

    const foods = Array.isArray(response.data.foods) ? response.data.foods : [];
    const selected = selectBestFood(foods, searchName);

    if (!selected) {
      return {
        found: false,
        foodName: originalFoodName,
        searchName,
        reason: "No se encontr\u00f3 informaci\u00f3n nutricional confiable",
      };
    }

    console.log("USDA selected:", selected.food.description, selected.food.dataType);
    console.log("Nutrients:", selected.nutrients);

    return {
      found: true,
      foodName: originalFoodName,
      searchName,
      ...selected.nutrients,
      source: "USDA",
    };
  } catch (error) {
    console.error("Fallo la consulta a USDA:", error.message);

    return {
      found: false,
      foodName: originalFoodName,
      searchName,
      reason: "No se pudo consultar USDA",
    };
  }
};

module.exports = {
  searchFoodNutrition,
  extractNutrients,
  scoreFoodResult,
};
