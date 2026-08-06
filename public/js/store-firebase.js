(async function () {
  try {
    if (!firebase.apps.length) return;

    const db = firebase.firestore();

    // Products
    const snap = await db.collection('products').get();

    products = snap.docs.map(d => {
      const p = d.data();

      return {
        id: d.id,
        name: p.name || p.title || 'Product',
        category: p.category || p.game || 'Gaming',
        desc: p.description || `${p.amount || ''} digital top-up`,
        price: Number(p.price || 0),
        bg: p.bg || p.image || p.img || '/assets/bg-pubg.svg',
        img: p.image || p.img || '/assets/item-uc.svg',
        popular: 10
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
    renderMiniSlider();

  } catch (e) {
    console.warn('Firestore products not loaded:', e.message);
  }
})();
