(async function(){
  try{
    if(!firebase.apps.length) return;

    const db = firebase.firestore();
    const snap = await db.collection('products').get();

    if(snap.empty) return;

    products = snap.docs.map(d => {
      const p = d.data();

      return {
        id: d.id,
        name: p.name || p.title || 'Product',
        category: p.category || p.game || 'Gaming',
        desc: p.description || `${p.amount || ''} digital top-up`,
        price: Number(p.price || 0),
        bg: p.bg || '/assets/bg-pubg.svg',
        img: p.image || '/assets/item-uc.svg',
        popular: 10
      };
    });

    categories = [...new Set(products.map(p => p.category || 'Gaming'))]
      .map(c => ({
        name: c,
        desc: c,
        bg: '/assets/bg-pubg.svg'
      }));

    renderCategories();
    renderFilters();
    renderProducts();
    renderMiniSlider();

  }catch(e){
    console.warn('Firestore products not loaded:', e.message);
  }
})();
