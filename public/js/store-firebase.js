(async function () {
  try {
    if (!firebase.apps.length) return;

    const db = firebase.firestore();

    window.categories = window.categories || [];
    window.products = window.products || [];

    // 1. حساب المخزون الحقيقي من الأكواد المتاحة
    const codesSnap = await db.collection('productCodes').where('status', '==', 'available').get();
    const stockCountMap = {};
    
    codesSnap.docs.forEach(doc => {
      const codeData = doc.data();
      const pId = codeData.productId;
      if (pId) {
        stockCountMap[pId] = (stockCountMap[pId] || 0) + 1;
      }
    });

    // 2. جلب المنتجات الحقيقية
    const snap = await db.collection('products').get();

    products = snap.docs.map(d => {
      const p = d.data();
      const realStock = stockCountMap[d.id] !== undefined ? stockCountMap[d.id] : Number(p.stock || p.quantity || p.qty || 0);

      return {
        id: d.id,
        name: p.name || p.title || 'Product',
        category: p.category || p.game || 'Gaming',
        desc: p.description || `${p.amount || ''} digital top-up`,
        price: Number(p.price || 0),
        stock: realStock, 
        bg: p.bg || p.image || p.img || '/assets/bg-pubg.svg',
        img: p.image || p.img || '/assets/item-uc.svg',
        popular: 10,
        reviews: p.reviews || [],
        verifiedBuyers: p.verifiedBuyers || []
      };
    });

    // 3. جلب الأقسام من فايبربيز حصرياً (مجموعتي categories أو Categories)
    let catSnap = await db.collection('categories').get();
    if (catSnap.empty) {
        catSnap = await db.collection('Categories').get();
    }

    if (!catSnap.empty) {
      categories = catSnap.docs.map(d => {
        const c = d.data();
        return {
          name: c.name || c.title || 'Category',
          desc: c.description || c.desc || '',
          bg: c.image || c.img || c.bg || '/assets/bg-pubg.svg'
        };
      });
    } else {
      // إذا لم تكن هناك وثائق أقسام مجهزة في القاعدة، نبنيها حصرياً من الأقسام الحقيقية للمنتجات المضافة
      const uniqueCats = [...new Set(products.map(p => p.category).filter(Boolean))];
      categories = uniqueCats.map(c => ({
        name: c,
        desc: `${c} Accounts & Services`,
        bg: '/assets/bg-pubg.svg'
      }));
    }

    window.categories = categories;

    // تنفيذ العرض الفوري
    if (typeof renderCategories === 'function') renderCategories();
    if (typeof renderFilters === 'function') renderFilters();
    if (typeof renderProducts === 'function') renderProducts();

  } catch (e) {
    console.warn('Firestore load error:', e.message);
  }
})();
