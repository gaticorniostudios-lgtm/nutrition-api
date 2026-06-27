const axios = require("axios");

const OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

const searchProductNutrition = async (query) => {
  try {
    const response = await axios.get(OPEN_FOOD_FACTS_SEARCH_URL, {
      params: {
        search_terms: query,
        search_simple: 1,
        action: "process",
        json: 1,
        page_size: 1,
        fields: "product_name,nutriments",
      },
      timeout: 10000,
      headers: {
        "User-Agent": "nutrition-api/1.0",
      },
    });

    const product = response.data.products?.[0];
    const nutriments = product?.nutriments;

    if (!nutriments) {
      return null;
    }

    return {
      calories: Number(nutriments["energy-kcal_100g"]) || 0,
      protein: Number(nutriments.proteins_100g) || 0,
      carbs: Number(nutriments.carbohydrates_100g) || 0,
      fat: Number(nutriments.fat_100g) || 0,
      source: "Open Food Facts",
      source_description: product.product_name || query,
    };
  } catch (error) {
    const offError = new Error(`Fallo la consulta a Open Food Facts: ${error.message}`);
    offError.statusCode = 502;
    throw offError;
  }
};

module.exports = {
  searchProductNutrition,
};
