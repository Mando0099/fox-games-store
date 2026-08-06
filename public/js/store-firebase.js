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

    // 2. جلب المنتجات (وهي الأساس اللي شغالة وزي الفل)
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

    // 3. الحل الفعلي الإجباري: بناء الأقسام مباشرة ودون انتظار من تصنيفات المنتجات الحقيقية
    const uniqueCategories = [...new Set(products.map(p => p.category || 'Gaming'))];
    
    window.categories = uniqueCategories.map(catName => ({
      name: catName,
      desc: `Explore our ${catName} accounts & services`,
      bg: '/assets/bg-pubg.svg'
    }));

    // لو المنتجات نفسها لسه مجتش لأي سبب، نضع أقسام افتراضية أساسية عشان تظهر فوراً
    if (!window.categories.length) {
      window.categories = [
        { name: 'Gaming', desc: 'Digital Gaming Accounts', bg: '/assets/bg-pubg.svg' },
        { name: 'Accounts', desc: 'Premium Digital Accounts', bg: '/assets/bg-pubg.svg' }
      ];
    }

    // تنفيذ الرسم الفوري المؤكد
    if (typeof renderCategories === 'function') renderCategories();
    if (typeof renderFilters === 'function') renderFilters();
    if (typeof renderProducts === 'function') renderProducts();
    
    // تأكيد إضافي بالرسم بعد التحميل بثوانٍ
    setTimeout(() => {
        if (typeof renderCategories === 'function') renderCategories();
    }, 300);

  } catch (e) {
    console.warn('Firestore load error:', e.message);
    // حتى لو حصل خطأ فادح في الاتصال، نضع أقسام افتراضية تظهر للمستخدم
    window.categories = [
      { name: 'Gaming', desc: 'Digital Gaming Accounts', bg: '/assets/bg-pubg.svg' }
    ];
    if (typeof renderCategories === 'function') renderCategories();
  }
})();
