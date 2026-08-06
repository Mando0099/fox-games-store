(async function () {
  try {
    if (!firebase.apps.length) return;

    const db = firebase.firestore();

    // 1. جلب الأكواد المتاحة أولاً لحساب المخزون الحقيقي لكل منتج
    const codesSnap = await db.collection('productCodes').where('status', '==', 'available').get();
    const stockCountMap = {};
    
    codesSnap.docs.forEach(doc => {
      const codeData = doc.data();
      const pId = codeData.productId;
      if (pId) {
        stockCountMap[pId] = (stockCountMap[pId] || 0) + 1;
      }
    });

    // 2. جلب المنتجات وربطها بالمخزون المحسوب من الأكواد
    const snap = await db.collection('products').get();

    products = snap.docs.map(d => {
      const p = d.data();
      const realStock = stockCountMap[d.id] !== undefined ? stockCountMap[d.id] : (p.stock || 0);

      return {
        id: d.id,
        name: p.name || p.title || 'Product',
        category: p.category || p.game || 'Gaming',
        desc: p.description || `${p.amount || ''} digital top-up`,
        price: Number(p.price || 0),
        stock: realStock, // المخزون هيظهر حقيقي بناءً على الأكواد المتاحة فعلياً
        bg: p.bg || p.image || p.img || '/assets/bg-pubg.svg',
        img: p.image || p.img || '/assets/item-uc.svg',
        popular: 10,
        reviews: p.reviews || [],
        verifiedBuyers: p.verifiedBuyers || []
      };
    });

    // Categories
    const catSnap = await db.collection('categories').get();

    if (!catSnap.empty) {
      categories = catSnap.docs.map(d => {
        const c = d.data();
        return {
          name: c.name || 'Category',
          desc: c.description || c.desc || '',
          bg: c.image || c.img || c.bg || '/assets/bg-pubg.svg'
        };
      });
    } else {
      categories = [...new Set(products.map(p => p.category || 'Gaming'))]
        .map(c => ({
          name: c,
          desc: c,
          bg: '/assets/bg-pubg.svg'
        }));
    }

    renderCategories();
    renderFilters();
    renderProducts();
    
    if (typeof renderMiniSlider === 'function') {
        renderMiniSlider();
    } else {
        window.renderMiniSlider = function() {};
    }

  } catch (e) {
    console.warn('Firestore products not loaded:', e.message);
  }
})();
