const fs = require("fs");
const path = require("path");
const express = require("express");

// Keep the existing JSON API, but allow a compressed product photo to travel
// in image_url as a data URL. The browser-side code below keeps images small.
const originalJson = express.json;
express.json = function productGalleryJson(options) {
  const nextOptions = { ...(options || {}) };
  const currentLimit = String(nextOptions.limit || "").toLowerCase();
  if (!nextOptions.limit || currentLimit === "200kb") nextOptions.limit = "2mb";
  return originalJson.call(express, nextOptions);
};

const originalReadFileSync = fs.readFileSync.bind(fs);

function injectProductGallery(source) {
  let html = String(source || "");
  if (!html.includes('id="productForm"') || html.includes('id="productImageFile"')) return html;

  const galleryField = `<input id="productImage" type="hidden"><input id="productImageUrl" type="url" placeholder="رابط صورة المنتج (اختياري) https://"><label class="product-image-picker" for="productImageFile"><span>🖼️</span><span><b>تحميل صورة المنتج من الاستديو</b><small>اضغط لاختيار صورة من الهاتف</small></span></label><input id="productImageFile" class="product-image-file" type="file" accept="image/*"><div id="productImagePreviewWrap" class="product-image-preview hidden"><img id="productImagePreview" alt="معاينة صورة المنتج"><button id="productImageRemove" type="button" class="btn btn-danger">حذف الصورة</button><small id="productImageStatus"></small></div>`;

  html = html.replace(/<input\s+id=["']productImage["'][^>]*>/i, galleryField);

  const styles = `<style id="product-gallery-upload-style">
  .product-image-file{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
  .product-image-picker{display:flex;align-items:center;gap:10px;min-height:58px;padding:11px 13px;border:1.5px dashed #c6922b;border-radius:12px;background:#fffaf0;cursor:pointer;color:#0b1f33}
  .product-image-picker>span:first-child{font-size:28px}.product-image-picker b,.product-image-picker small{display:block}.product-image-picker small{margin-top:3px;color:#6c7580;font-weight:400}
  .product-image-preview{grid-column:1/-1;display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding:10px;border:1px solid #e5dfd4;border-radius:12px;background:#fff}
  .product-image-preview img{width:92px;height:92px;object-fit:cover;border-radius:12px;border:1px solid #e5dfd4;background:#f5f7f9}
  .product-image-preview small{color:#6c7580;flex:1;min-width:150px}
  @media(max-width:760px){.product-image-preview{grid-column:auto}.product-image-picker{min-height:64px}}
  </style>`;
  html = html.replace("</head>", styles + "</head>");

  const script = `<script id="product-gallery-upload-script">
  (function(){
    var MAX_SOURCE_BYTES=8*1024*1024;
    var MAX_DATA_URL_CHARS=1450000;
    function byId(id){return document.getElementById(id)}
    function showPreview(value,status){
      var wrap=byId('productImagePreviewWrap'),img=byId('productImagePreview'),note=byId('productImageStatus');
      if(!wrap||!img)return;
      var src=String(value||'').trim();
      if(src){img.src=src;wrap.classList.remove('hidden');if(note)note.textContent=status||'الصورة جاهزة للحفظ مع المنتج';}
      else{img.removeAttribute('src');wrap.classList.add('hidden');if(note)note.textContent='';}
    }
    function imageFromFile(file){
      return new Promise(function(resolve,reject){
        var url=URL.createObjectURL(file),img=new Image();
        img.onload=function(){URL.revokeObjectURL(url);resolve(img)};
        img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة المختارة'))};
        img.src=url;
      });
    }
    async function compressImage(file){
      if(!file||!String(file.type||'').startsWith('image/'))throw new Error('اختر ملف صورة صالح');
      if(file.size>MAX_SOURCE_BYTES)throw new Error('حجم الصورة الأصلية أكبر من 8MB');
      var img=await imageFromFile(file);
      var maxSide=950;
      var ratio=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
      var width=Math.max(1,Math.round((img.naturalWidth||img.width)*ratio));
      var height=Math.max(1,Math.round((img.naturalHeight||img.height)*ratio));
      var canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,width,height);
      var data=canvas.toDataURL('image/jpeg',0.78);
      if(data.length>MAX_DATA_URL_CHARS){
        var smaller=document.createElement('canvas');
        var ratio2=Math.min(1,760/Math.max(width,height));
        smaller.width=Math.max(1,Math.round(width*ratio2));smaller.height=Math.max(1,Math.round(height*ratio2));
        smaller.getContext('2d').drawImage(canvas,0,0,smaller.width,smaller.height);
        data=smaller.toDataURL('image/jpeg',0.68);
      }
      if(data.length>MAX_DATA_URL_CHARS)throw new Error('الصورة ما زالت كبيرة بعد الضغط؛ اختر صورة أصغر');
      return data;
    }
    function syncFromUrl(){
      var hidden=byId('productImage'),url=byId('productImageUrl');if(!hidden||!url)return;
      hidden.value=url.value.trim();showPreview(hidden.value,hidden.value?'سيتم استخدام رابط الصورة':'');
    }
    function resetGallery(){
      var hidden=byId('productImage'),url=byId('productImageUrl'),file=byId('productImageFile');
      if(hidden)hidden.value='';if(url)url.value='';if(file)file.value='';showPreview('');
    }
    function install(){
      var hidden=byId('productImage'),url=byId('productImageUrl'),file=byId('productImageFile'),remove=byId('productImageRemove'),form=byId('productForm');
      if(!hidden||!file||!form)return;
      if(url)url.addEventListener('input',syncFromUrl);
      file.addEventListener('change',async function(){
        var selected=file.files&&file.files[0];if(!selected)return;
        var submit=byId('productSubmit');if(submit)submit.disabled=true;
        try{
          var data=await compressImage(selected);hidden.value=data;if(url)url.value='';
          showPreview(data,'تم ضغط الصورة وهي جاهزة للنشر');
          if(typeof toast==='function')toast('تم تحميل صورة المنتج من الاستديو');
        }catch(error){file.value='';if(typeof toast==='function')toast(error.message);else alert(error.message)}
        finally{if(submit)submit.disabled=false;}
      });
      if(remove)remove.addEventListener('click',function(){resetGallery();if(typeof toast==='function')toast('تم حذف صورة المنتج من النموذج')});
      form.addEventListener('reset',function(){setTimeout(resetGallery,0)});
      var originalEdit=window.editProduct;
      if(typeof originalEdit==='function')window.editProduct=function(id){
        originalEdit(id);
        var value=hidden.value||'';
        if(url)url.value=/^https?:\/\//i.test(value)?value:'';
        showPreview(value,value?'الصورة الحالية للمنتج':'');
      };
      if(hidden.value)showPreview(hidden.value,'الصورة الحالية للمنتج');
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  })();
  </script>`;
  html = html.replace("</body>", script + "</body>");
  return html;
}

fs.readFileSync = function productGalleryReadFileSync(filePath, options) {
  const result = originalReadFileSync(filePath, options);
  const encoding = typeof options === "string" ? options : options && options.encoding;
  const isUtf8 = String(encoding || "").toLowerCase().replace("-", "") === "utf8";
  const fileName = path.basename(String(filePath || "")).toLowerCase();
  if (isUtf8 && fileName === "admin.html") return injectProductGallery(result);
  return result;
};
