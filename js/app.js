console.log('✅ app.js yüklendi!');

// ============================================================
// API (TheMealDB)
// ============================================================
const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

async function fetchCategories() {
    const res = await fetch(`${BASE_URL}/categories.php`);
    const data = await res.json();
    return data.categories.map(c => c.strCategory);
}

async function fetchAllRecipes() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    let allMeals = [];

    for (const letter of letters) {
        const res = await fetch(`${BASE_URL}/search.php?s=${letter}`);
        const data = await res.json();
        if (data.meals) {
            allMeals = allMeals.concat(data.meals);
        }
    }

    const uniqueMeals = allMeals.filter((meal, index, self) =>
        index === self.findIndex(m => m.idMeal === meal.idMeal)
    );

    const validMeals = uniqueMeals.filter(meal => 
        meal.strMeal && 
        meal.strMealThumb && 
        meal.strMeal !== 'null' &&
        meal.strMealThumb !== 'null'
    );

    console.log(`✅ ${validMeals.length} tarif bulundu.`);
    return validMeals;
}

async function fetchRecipeById(id) {
    const res = await fetch(`${BASE_URL}/lookup.php?i=${id}`);
    const data = await res.json();
    return data.meals[0];
}

// ============================================================
// DEEPL ÇEVİRİ (Vercel Serverless Function)
// ============================================================
async function translateText(text, targetLang = 'tr') {
    if (!text) return text;
    if (targetLang === 'en') return text;

    console.log('🟡 translateText çağrıldı, çevrilecek metin:', text);

    try {
        const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: text, 
                targetLang: targetLang.toUpperCase() 
            })
        });
        const data = await res.json();
        return data.translated || text;
    } catch (error) {
        console.error('❌ Çeviri hatası:', error);
        return text;
    }
}

// ============================================================
// DOM
// ============================================================
const loader = document.getElementById('loader');
const mainSite = document.getElementById('main-site');
const categoryList = document.getElementById('category-list');
const recipeList = document.getElementById('recipe-list');
const resetBtn = document.getElementById('reset-filter-btn');

// ============================================================
// RENDER KATEGORİLER (İngilizce)
// ============================================================
function renderCategories(tags) {
    if (!tags || tags.length === 0) {
        categoryList.innerHTML = '<p class="error-message">Kategori bulunamadı.</p>';
        return;
    }

    const sortedTags = [...tags].sort();

    categoryList.innerHTML = `
        <div class="category-item" data-category="all" style="font-weight: bold; border-bottom: 2px solid #e67e22;">
            Tüm Tarifler
        </div>
        ${sortedTags.map(tag => `
            <div class="category-item" data-category="${tag}">
                ${tag}
            </div>
        `).join('')}
    `;
}

// ============================================================
// RENDER TARİFLER
// ============================================================
let allRecipesCache = [];
let currentPage = 0;
const PAGE_SIZE = 12;

async function renderRecipes(recipes) {
    if (!recipes || recipes.length === 0) {
        recipeList.innerHTML = '<p class="error-message">Tarif bulunamadı.</p>';
        return;
    }

    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    // Tüm tarifleri dönüştür (çeviri işlemini burada yap)
    const translatedRecipes = await Promise.all(recipes.map(async (meal) => {
        const isFav = favorites.includes(meal.idMeal);
        const image = meal.strMealThumb && meal.strMealThumb !== 'null' 
            ? meal.strMealThumb 
            : 'https://via.placeholder.com/300x200?text=Resim+Yok';
        
        const translatedTitle = await translateText(meal.strMeal);
        const translatedCategory = await translateText(meal.strCategory || '');

        return `
            <div class="recipe-card" data-id="${meal.idMeal}">
                <div class="favorite-btn" data-id="${meal.idMeal}" style="position: absolute; top: 12px; right: 12px; cursor: pointer; font-size: 1.5rem; z-index: 10; background: rgba(255,255,255,0.8); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    ${isFav ? '❤️' : '🤍'}
                </div>
                <img src="${image}" alt="${translatedTitle || 'Tarif'}" loading="lazy">
                <h3>${translatedTitle || 'İsimsiz Tarif'}</h3>
                <p>${translatedCategory || 'Çeşitli'} • ${meal.strArea || 'Dünya'}</p>
                <p class="rating">⭐ 4.5</p>
            </div>
        `;
    }));

    recipeList.innerHTML = translatedRecipes.join('');
}

// ============================================================
// DETAY SAYFASI
// ============================================================
async function showDetail(id) {
    try {
        const meal = await fetchRecipeById(id);

        document.getElementById('detail-title').textContent = await translateText(meal.strMeal);
        document.getElementById('detail-image').src = meal.strMealThumb;
        document.getElementById('detail-category').textContent = await translateText(meal.strCategory || 'Çeşitli');
        document.getElementById('detail-time').textContent = '30 dk';
        document.getElementById('detail-rating').textContent = '4.5';
        document.getElementById('detail-description').textContent = await translateText(meal.strInstructions || 'Nefis bir tarif!');

        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            const measure = meal[`strMeasure${i}`];
            if (ingredient && ingredient.trim()) {
                const translatedIng = await translateText(`${measure} ${ingredient}`);
                ingredients.push(translatedIng);
            }
        }

        const ingList = document.getElementById('detail-ingredients');
        ingList.innerHTML = ingredients.map(i => `<li>${i}</li>`).join('');

        const steps = meal.strInstructions.split('\r\n').filter(s => s.trim());
        const translatedSteps = await Promise.all(steps.map(s => translateText(s)));
        const stepsList = document.getElementById('detail-steps');
        stepsList.innerHTML = translatedSteps.map(s => `<li>${s}</li>`).join('');

        document.getElementById('main-content').style.display = 'none';
        document.getElementById('detail-section').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('❌ Detay hatası:', error);
    }
}

function hideDetail() {
    document.getElementById('detail-section').classList.remove('active');
    document.getElementById('main-content').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// LOADER YÖNETİMİ + BAŞLANGIÇ YÜKLEMESİ
// ============================================================
async function init() {
    try {
        console.log('🔄 Veriler yükleniyor...');
        
        const tags = await fetchCategories();
        renderCategories(tags);

        const meals = await fetchAllRecipes();
        allRecipesCache = meals;
        const firstPage = allRecipesCache.slice(0, PAGE_SIZE);
        await renderRecipes(firstPage);
        currentPage = 1;

        console.log(`✅ ${allRecipesCache.length} tarif yüklendi.`);

        // "Tüm Tarifler"i varsayılan olarak aktif yap
        const allItem = document.querySelector('.category-item[data-category="all"]');
        if (allItem) {
            allItem.classList.add('active');
        }

        setTimeout(() => {
            loader.classList.add('hidden');
            mainSite.style.display = 'block';
            document.body.style.overflow = 'auto';
        }, 2000);

    } catch (error) {
        console.error('❌ Yükleme hatası:', error);
        loader.classList.add('hidden');
        mainSite.style.display = 'block';
        document.body.style.overflow = 'auto';
    }
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
// SONSUZ KAYDIRMA
// ============================================================
let isLoading = false;
let hasMore = true;

async function loadMoreRecipes() {
    if (isLoading || !hasMore || !allRecipesCache.length) return;

    isLoading = true;
    console.log('🔄 Daha fazla tarif yükleniyor...');

    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const newRecipes = allRecipesCache.slice(start, end);

    if (newRecipes.length === 0) {
        hasMore = false;
        isLoading = false;
        console.log('✅ Tüm tarifler yüklendi.');
        return;
    }

    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    const translatedRecipes = await Promise.all(newRecipes.map(async (meal) => {
        const isFav = favorites.includes(meal.idMeal);
        const translatedTitle = await translateText(meal.strMeal);
        const translatedCategory = await translateText(meal.strCategory || '');
        return `
            <div class="recipe-card" data-id="${meal.idMeal}">
                <div class="favorite-btn" data-id="${meal.idMeal}" style="position: absolute; top: 12px; right: 12px; cursor: pointer; font-size: 1.5rem; z-index: 10; background: rgba(255,255,255,0.8); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    ${isFav ? '❤️' : '🤍'}
                </div>
                <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy">
                <h3>${translatedTitle || 'İsimsiz Tarif'}</h3>
                <p>${translatedCategory || 'Çeşitli'} • ${meal.strArea || 'Dünya'}</p>
                <p class="rating">⭐ 4.5</p>
            </div>
        `;
    }));

    recipeList.insertAdjacentHTML('beforeend', translatedRecipes.join(''));
    currentPage++;
    console.log(`✅ ${newRecipes.length} yeni tarif eklendi.`);
    isLoading = false;
}

window.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollY + windowHeight >= documentHeight - 300) {
        loadMoreRecipes();
    }
});

// ============================================================
// KATEGORİ FİLTRELEME (İngilizce)
// ============================================================
categoryList.addEventListener('click', async function(e) {
    const item = e.target.closest('.category-item');
    if (!item) return;

    // Tüm kategorilerden active class'ını kaldır
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    
    // Tıklanan kategoriye active ekle
    item.classList.add('active');

    const category = item.dataset.category;
    console.log('🟢 Kategori seçildi:', category);

    hasMore = false;
    isLoading = false;

    if (category === 'all') {
        const firstPage = allRecipesCache.slice(0, PAGE_SIZE);
        await renderRecipes(firstPage);
        currentPage = 1;
        hasMore = true;
        resetBtn.style.display = 'none';
    } else {
        const filtered = allRecipesCache.filter(r => 
            r.strCategory === category
        );
        await renderRecipes(filtered);
        resetBtn.style.display = 'inline-block';
        hasMore = false;
    }

    document.querySelector('.recipes').scrollIntoView({ behavior: 'smooth' });
});

// ============================================================
// TÜM TARİFLERİ GÖSTER
// ============================================================
resetBtn.addEventListener('click', async function() {
    const firstPage = allRecipesCache.slice(0, PAGE_SIZE);
    await renderRecipes(firstPage);
    currentPage = 1;
    hasMore = true;
    resetBtn.style.display = 'none';
});

// ============================================================
// FAVORİ + DETAY TIKLAMASI
// ============================================================
recipeList.addEventListener('click', function(e) {
    const favBtn = e.target.closest('.favorite-btn');
    if (favBtn) {
        e.stopPropagation();
        e.preventDefault();

        const id = parseInt(favBtn.dataset.id);
        let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

        let message = '';
        if (favorites.includes(id)) {
            favorites = favorites.filter(fav => fav !== id);
            favBtn.textContent = '🤍';
            message = 'Tarif favorilerden çıkarıldı!';
        } else {
            favorites.push(id);
            favBtn.textContent = '❤️';
            message = 'Tarif favorilere eklendi!';
        }

        localStorage.setItem('favorites', JSON.stringify(favorites));
        showToast(message, 1500);
        return;
    }

    const card = e.target.closest('.recipe-card');
    if (card) {
        const id = parseInt(card.dataset.id);
        if (!isNaN(id)) {
            showDetail(id);
        }
    }
});

// ============================================================
// GERİ DÖNÜŞLER
// ============================================================
document.getElementById('back-button').addEventListener('click', hideDetail);
document.getElementById('home-link').addEventListener('click', function(e) {
    e.preventDefault();
    hideDetail();
});

document.getElementById('logo-link').addEventListener('click', function(e) {
    e.preventDefault();
    const detailSection = document.getElementById('detail-section');
    if (detailSection.classList.contains('active')) {
        hideDetail();
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

// ============================================================
// ARAMA
// ============================================================
document.getElementById('search-button').addEventListener('click', async function() {
    const query = document.getElementById('search-input').value.toLowerCase();
    if (!query) return;

    const filtered = allRecipesCache.filter(r =>
        r.strMeal.toLowerCase().includes(query) ||
        r.strCategory.toLowerCase().includes(query)
    );
    await renderRecipes(filtered);
    hasMore = false;
    resetBtn.style.display = 'none';
});

document.getElementById('search-input').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('search-button').click();
    }
});

// ============================================================
// BİLDİRİM
// ============================================================
function showToast(message, duration = 1500) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, duration);
}

// ============================================================
// LOGIN MODAL
// ============================================================
const loginModal = document.getElementById('login-modal');
const loginBtn = document.querySelector('.btn-login');
const closeModal = document.querySelector('.close-modal');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const socialBtns = document.querySelectorAll('.social-btn');
const authForms = document.querySelectorAll('.auth-form');

loginBtn.addEventListener('click', () => {
    loginModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
    loginModal.classList.remove('active');
});

loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.classList.remove('active');
    }
});

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

socialBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const provider = btn.textContent.trim();
        alert(`🔐 "${provider}" girişi yakında eklenecek!`);
        loginModal.classList.remove('active');
    });
});

authForms.forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-btn.active');
        const tabName = activeTab ? activeTab.dataset.tab : 'login';
        if (tabName === 'login') {
            alert('✅ Giriş başarılı! (Demo)');
        } else if (tabName === 'register') {
            alert('🎉 Kayıt başarılı! (Demo)');
        } else if (tabName === 'forgot') {
            alert('📧 Şifre sıfırlama bağlantısı gönderildi! (Demo)');
        }
        loginModal.classList.remove('active');
    });
});

// ============================================================
// DARK MODE (Kalıcı)
// ============================================================
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-toggle').textContent = '☀️';
} else {
    document.body.classList.remove('dark');
    document.getElementById('theme-toggle').textContent = '🌙';
}

document.getElementById('theme-toggle').addEventListener('click', function() {
    document.body.classList.toggle('dark');
    if (document.body.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
        this.textContent = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        this.textContent = '🌙';
    }
});