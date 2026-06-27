const localNutrition = require("../data/localNutrition");
const { normalizeFoodName } = require("./normalizeFoodName");

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const isNumeric = (value) => typeof value === "number" && Number.isFinite(value);

const normalizedLocalNutrition = Object.entries(localNutrition).map(([name, nutrition]) => ({
  name,
  normalizedName: normalizeFoodName(name),
  nutrition,
}));

const findLocalNutrition = (foodName) => {
  const normalizedFoodName = normalizeFoodName(foodName);

  if (!normalizedFoodName) return null;

  const exactMatch = normalizedLocalNutrition.find(
    (item) => item.normalizedName === normalizedFoodName
  );

  if (exactMatch) {
    return {
      matchedName: exactMatch.name,
      ...exactMatch.nutrition,
    };
  }

  // Coincidencia flexible: "tomate en rodajas" encuentra "tomate",
  // y "papas fritas (pajita)" encuentra "papas fritas pajita".
  const partialMatch = normalizedLocalNutrition
    .filter(
      (item) =>
        normalizedFoodName.includes(item.normalizedName) ||
        item.normalizedName.includes(normalizedFoodName)
    )
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length)[0];

  if (!partialMatch) return null;

  return {
    matchedName: partialMatch.name,
    ...partialMatch.nutrition,
  };
};

const calculateNutritionForPortion = (nutritionPer100g, grams) => {
  // Los datos locales y USDA usan nutrientes por 100 g; aqui se escalan a la porcion estimada.
  const multiplier = (Number(grams) || 0) / 100;

  return {
    calories: isNumeric(nutritionPer100g.caloriesPer100g)
      ? round(nutritionPer100g.caloriesPer100g * multiplier, 0)
      : null,
    protein: isNumeric(nutritionPer100g.proteinPer100g)
      ? round(nutritionPer100g.proteinPer100g * multiplier, 1)
      : null,
    carbs: isNumeric(nutritionPer100g.carbsPer100g)
      ? round(nutritionPer100g.carbsPer100g * multiplier, 1)
      : null,
    fat: isNumeric(nutritionPer100g.fatPer100g)
      ? round(nutritionPer100g.fatPer100g * multiplier, 1)
      : null,
  };
};

const sumNutritionTotals = (foods) => {
  // Solo suma alimentos con valores numericos; ignora null cuando no hay datos confiables.
  return foods.reduce(
    (totals, food) => ({
      calories: round(totals.calories + (isNumeric(food.calories) ? food.calories : 0), 0),
      protein: round(totals.protein + (isNumeric(food.protein) ? food.protein : 0), 1),
      carbs: round(totals.carbs + (isNumeric(food.carbs) ? food.carbs : 0), 1),
      fat: round(totals.fat + (isNumeric(food.fat) ? food.fat : 0), 1),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  );
};

module.exports = {
  calculateNutritionForPortion,
  findLocalNutrition,
  sumNutritionTotals,
};
