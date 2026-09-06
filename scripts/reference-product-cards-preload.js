const express = require('express');

const previousStatic = express.static;

const styles = `<style id="reference-product-cards-style">
#products{background:#fff!important;padding-top:30px!important}
#products .section-head{margin-bottom:14px!important;align-items:center!important}
#products .section-head h2{font-size:30px!important;color:#0b2b4b!important;font-weight:950!important;margin:0!important}
#products .section-head .muted{display:none!important}
#products .products{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px!important;align-items:stretch!important}
#products .product-card{position:relative!important;background:#fff!important;border:1px solid #dfe5ea!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 5px 16px rgba(15,42,66,.10)!important;display:flex!important;flex-direction:column!important;min-width:0!important;transition:transform .15s ease,box-shadow .15s ease!important}
#products .product-card:hover{transform:translateY(-2px)!important;box-shadow:0 10px 26px rgba(15,42,66,.14)!important}
#products .product-img{height:245px!important;background:#f8fafb!important;display:flex!important;align-items:center!important;justify-content:center!important;position:relative!important;overflow:hidden!important;border-bottom:1px solid #edf0f2!important}
#products .product-img img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
#products .product-img:not(:has(img)){font-size:68px!important}
#products .product-badges{position:absolute!important;top:10px!important;right:10px!important;z-index:3!important;display:flex!important;gap:5px!important}
#products .offer-badge{display:none!important}
#products .discount-badge{background:#d91d2b!important;color:#fff!important;border-radius:7px!important;padding:4px 7px!important;font-size:11px!important;font-weight:900!important}
#products .product-wish{position:absolute!important;top:9px!important;left:9px!important;right:auto!important;width:36px!important;height:36px!important;border-radius:50%!important;border:1px solid #d8e0e7!important;background:rgba(255,255,255,.97)!important;color:#16324e!important;font-size:22px!important;display:grid!important;place-items:center!important;z-index:5!important;box-shadow:0 2px 8px rgba(0,0,0,.06)!important;padding:0!important}
#products .product-body{padding:0 14px 14px!important;display:flex!important;flex-direction:column!important;flex:1!important;min-height:260px!important}
#products .rifai-brand{display:inline-flex!important;align-items:center!important;align-self:flex-start!important;min-height:30px!important;padding:4px 10px!important;margin-top:-15px!important;margin-bottom:7px!important;background:#fff!important;border:1px solid #e0e5ea!important;border-radius:10px!important;color:#0c6fb6!important;font-weight:950!important;font-size:15px!important;position:relative!important;z-index:4!important;box-shadow:0 2px 7px rgba(10,39,65,.06)!important}
#products .product-body h3{margin:2px 0 3px!important;color:#102d49!important;font-size:16px!important;line-height:1.35!important;font-weight:950!important;min-height:43px!important;text-align:right!important}
#products .product-category{margin:0 0 5px!important;color:#77828d!important;font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#products .rifai-model{font-size:12px!important;color:#717c86!important;direction:ltr!important;text-align:right!important;margin:-1px 0 7px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#products .stock-label{display:inline-flex!important;align-items:center!important;align-self:flex-start!important;background:#e8fbef!important;color:#108343!important;border-radius:6px!important;padding:4px 9px!important;font-size:11px!important;font-weight:800!important;margin:0 0 9px!important}
#products .stock-label.out{background:#fff0f0!important;color:#c62828!important}
#products .rifai-features{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:4px!important;margin:3px 0 11px!important;padding-top:5px!important}
#products .rifai-feature{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;text-align:center!important;gap:3px!important;color:#5f6d79!important;font-size:10px!important;line-height:1.25!important;min-width:0!important}
#products .rifai-feature i{width:29px!important;height:29px!important;border:1px solid #d7e0e8!important;border-radius:50%!important;display:grid!important;place-items:center!important;font-style:normal!important;font-size:14px!important;background:#fff!important;color:#153a60!important}
#products .rifai-feature b{font-weight:700!important;display:block!important;max-width:72px!important}
#products .product-prices{margin-top:auto!important;margin-bottom:8px!important;min-height:0!important}
#products .product-prices strong{font-size:15px!important;color:#0f2d4b!important}
#products .old-price{font-size:11px!important}
#products .product-action{width:calc(100% + 28px)!important;margin:0 -14px -14px!important;border-radius:0!important;min-height:44px!important;background:linear-gradient(135deg,#c58c20,#d8a13c)!important;color:#fff!important;font-size:15px!important;font-weight:950!important;border:0!important;box-shadow:none!important}
#products .product-action:after{content:'  🛒'!important;font-size:16px!important}
#products .product-action:disabled{background:#c9cfd4!important;color:#fff!important}
@media(max-width:760px){
 #products .wrap{padding-inline:10px!important}
 #products .section-head h2{font-size:24px!important}
 #products .section-head .btn{font-size:11px!important;padding:8px 10px!important;border-radius:999px!important}
 #products .products{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
 #products .product-card{border-radius:10px!important;box-shadow:0 3px 10px rgba(15,42,66,.10)!important}
 #products .product-img{height:145px!important}
 #products .product-body{padding:0 7px 8px!important;min-height:222px!important}
 #products .rifai-brand{font-size:10px!important;min-height:23px!important;padding:3px 6px!important;margin-top:-11px!important;margin-bottom:4px!important;border-radius:7px!important}
 #products .product-body h3{font-size:11px!important;min-height:30px!important;line-height:1.3!important;margin-top:1px!important}
 #products .product-category{font-size:9px!important;margin-bottom:3px!important}
 #products .rifai-model{font-size:8px!important;margin-bottom:4px!important}
 #products .stock-label{font-size:8px!important;padding:3px 5px!important;margin-bottom:5px!important}
 #products .rifai-features{gap:1px!important;margin-bottom:6px!important;padding-top:2px!important}
 #products .rifai-feature{font-size:7px!important;gap:2px!important}
 #products .rifai-feature i{width:21px!important;height:21px!important;font-size:10px!important}
 #products .rifai-feature b{max-width:45px!important}
 #products .product-prices strong{font-size:10px!important}
 #products .product-action{width:calc(100% + 14px)!important;margin:0 -7px -8px!important;min-height:34px!important;font-size:10px!important;padding:6px 2px!important}
 #products .product-action:after{font-size:11px!important}
 #products .product-wish{width:27px!important;height:27px!important;font-size:16px!important;top:6px!important;left:6px!important}
 #products .toolbar{display:none!important}
}
@media(max-width:390px){#products .products{gap:5px!important}#products .product-img{height:128px!important}#products .product-body h3{font-size:10px!important}}
</style>`;

const script = `<script id="reference-product-cards-script">(function(){
function low(v){return String(v||'').toLowerCase()}
function brandFor(name,cat){var n=low(name),c=low(cat);if(n.includes('unv')||n.includes('كاميرا'))return 'UNV';if(n.includes('jimi')||n.includes('vl110'))return 'Jimi';if(n.includes('midea')||n.includes('ميديا')||n.includes('مكيف'))return 'Midea';if(n.includes('samsung')||n.includes('سامسونج'))return 'Samsung';if(n.includes('gree')||n.includes('جري'))return 'Gree';if(c.includes('طاقة')||n.includes('solar'))return 'Solar';return 'الرفاعي'}
function modelFor(name,cat){var n=String(name||'').trim();var hit=n.match(/[A-Z]{1,5}[A-Z0-9-]{3,}/i);return hit?hit[0]:(cat||'منتج معتمد من المورد')}
function featuresFor(name,cat){var n=low(name+' '+cat);if(n.includes('كاميرا')||n.includes('unv'))return [['4MP','دقة عالية'],['◐','رؤية ليلية'],['🛡','مقاوم للماء']];if(n.includes('تتبع')||n.includes('jimi')||n.includes('gps'))return [['4G','يدعم LTE'],['⌖','تتبع مباشر GPS'],['♢','تنبيهات فورية']];if(n.includes('مكيف')||n.includes('midea')||n.includes('gree'))return [['❄','تبريد قوي'],['♧','موفر للطاقة'],['🛡','ضمان الوكيل']];if(n.includes('طاقة')||n.includes('solar'))return [['☀','كفاءة عالية'],['⚡','طاقة مستقرة'],['🛡','ضمان المورد']];if(n.includes('سيار'))return [['✓','فحص موثق'],['🚘','حالة واضحة'],['🛡','خدمة شحن']];return [['✓','منتج أصلي'],['★','جودة موثوقة'],['🛡','ضمان المورد']]}
function enhance(){document.querySelectorAll('#products .product-card').forEach(function(card){if(card.dataset.referenceCard==='1')return;var body=card.querySelector('.product-body'),nameEl=body&&body.querySelector('h3'),catEl=body&&body.querySelector('.product-category');if(!body||!nameEl)return;var name=nameEl.textContent.trim(),cat=catEl?catEl.textContent.trim():'';var brand=document.createElement('div');brand.className='rifai-brand';brand.textContent=brandFor(name,cat);body.insertBefore(brand,body.firstChild);var model=document.createElement('div');model.className='rifai-model';model.textContent=modelFor(name,cat);if(catEl)catEl.insertAdjacentElement('afterend',model);else nameEl.insertAdjacentElement('afterend',model);var stock=body.querySelector('.stock-label');if(stock){var out=/نفد|غير متوفر/.test(stock.textContent);stock.textContent=out?'غير متوفر':'متوفر في المخزون';if(out)stock.classList.add('out')}else{stock=document.createElement('div');stock.className='stock-label';stock.textContent='متوفر في المخزون';model.insertAdjacentElement('afterend',stock)}var fs=featuresFor(name,cat),wrap=document.createElement('div');wrap.className='rifai-features';wrap.innerHTML=fs.map(function(f){return '<span class="rifai-feature"><i>'+f[0]+'</i><b>'+f[1]+'</b></span>'}).join('');stock.insertAdjacentElement('afterend',wrap);card.dataset.referenceCard='1'})}
function boot(){enhance();var grid=document.getElementById('productsGrid');if(grid)new MutationObserver(enhance).observe(grid,{childList:true,subtree:true});setTimeout(enhance,300);setTimeout(enhance,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();})();</script>`;

function inject(html){
  if(typeof html !== 'string' || !html.includes('</body>')) return html;
  let out=html;
  if(!out.includes('id="reference-product-cards-style"')) out=out.replace('</head>',styles+'\n</head>');
  if(!out.includes('id="reference-product-cards-script"')) out=out.replace('</body>',script+'\n</body>');
  return out;
}

express.static = function referenceProductCardsStatic(root, options){
  const middleware = previousStatic(root, options);
  return function referenceProductCardsMiddleware(req,res,next){
    const pathname=String(req.path||req.url||'').split('?')[0];
    if((req.method==='GET'||req.method==='HEAD') && (pathname==='/'||pathname==='/index.html'||pathname==='/products.html')){
      const send=res.send.bind(res);
      res.send=function patchedSend(body){if(typeof body==='string') body=inject(body);return send(body)};
    }
    return middleware(req,res,next);
  };
};

module.exports={inject};
