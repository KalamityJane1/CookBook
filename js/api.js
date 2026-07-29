// ============================================================
// API Çağrıları - DummyJSON + DeepL
// ============================================================

const BASE_URL = 'https://dummyjson.com';
const DEEPL_API_KEY = 'd5ea9c8e-e4fe-4c5d-b736-3775fd114125:fx'; // <-- Buraya kendi anahtarını yapıştır

// DeepL ile metin çevir
export async function translateText(text, targetLang = 'TR') {
    if (!text) return text;
    
    // Eğer zaten çevrilmişse localStorage'dan al
    const cacheKey = `trans_${text.substring(0, 30)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`
            },
            body: new URLSearchParams({
                text: text,
                target_lang: targetLang,
                source_lang: 'EN'
            })
        });

        const data = await response.json();
        const translated = data.translations[0].text;
        
        // Cache'e kaydet (1 saat geçerli)
        localStorage.setItem(cacheKey, translated);
        return translated;
    } catch (error) {
        console.error('❌ DeepL çeviri hatası:', error);
        return text; // Hata olursa orijinal metni döndür
    }
}

// Tüm tarifleri çevir
export async function translateRecipes(recipes) {
    const translatedRecipes = [];
    
    for (const recipe of recipes) {
        const translated = { ...recipe };
        
        // Tarif adını çevir
        translated.name = await translateText(recipe.name);
        
        // Kategoriyi çevir
        translated.cuisine = await translateText(recipe.cuisine);
        
        // Malzemeleri çevir
        if (recipe.ingredients) {
            translated.ingredients = await Promise.all(
                recipe.ingredients.map(ing => translateText(ing))
            );
        }
        
        // Talimatları çevir
        if (recipe.instructions) {
            translated.instructions = await Promise.all(
                recipe.instructions.map(inst => translateText(inst))
            );
        }
        
        translatedRecipes.push(translated);
    }
    
    return translatedRecipes;
}

// Kategorileri çevir
export async function translateCategories(tags) {
    const translated = [];
    for (const tag of tags) {
        translated.push(await translateText(tag));
    }
    return translated;
}