const fs = require("fs");
const path = require("path");
const express = require("express");

// Car photos are compressed in the browser and sent through the existing JSON API.
// Keep enough headroom for one main photo plus a small gallery.
const originalJson = express.json;
express.json = function carsGalleryJson(options) {
  const nextOptions = { ...(options || {}) };
  const currentLimit = String(nextOptions.limit || "").toLowerCase();
  if (!nextOptions.limit || ["200kb", "2mb"].includes(currentLimit)) nextOptions.limit = "6mb";
  return originalJson.call(express, nextOptions);
};

const originalReadFileSync = fs.readFileSync.bind(fs);
const originalStatic = express.static;
const originalSend = express.response.send;

function injectCarsGallery(source) {
  let html = String(source || "");
  if (!html.includes('id="carForm"') || html.includes('id="carImageFile"')) return html;

  const mainPicker = `<input id="carImage" type="hidden"><div class="car-upload-box half"><label class="car-image-picker" for="carImageFile"><span>🖼️</span><span><b>اختيار الصورة الرئيسية من الاستديو</b><small>اضغط لاختيار صورة من الهاتف</small></span></label><input id="carImageFile" class="car-image-file" type="file" accept="image/*"><input id="carImageUrl" class="field" type="url" placeholder="أو رابط الصورة الرئيسية https://"><div id="carImagePreviewWrap" class="car-upload-preview hidden"><img id="carImagePreview" alt="معاينة الصورة الرئيسية"><button id="carImageRemove" class="mini-btn mini-stop" type="button">حذف الصورة</button><small id="carImageStatus"></small></div></div>`;
  const galleryPicker = `<input id="carGallery" type="hidden"><div class="car-upload-box half"><label class="car-image-picker" for="carGalleryFiles"><span>📷</span><span><b>إضافة صور أخرى من الاستديو</b><small>يمكن اختيار حتى 5 صور إضافية</small></span></label><input id="carGalleryFiles" class="car-image-file" type="file" accept="image/*" multiple><textarea id="carGalleryUrl" class="field" rows="2" placeholder="أو روابط صور إضافية (اختياري)"></textarea><div id="carGalleryPreview" class="car-gallery-preview"></div><small id="carGalleryStatus" class="car-gallery-status"></small></div>`;

  html = html.replace(/<input\s+id=["']carImage["'][^>]*>/i, mainPicker);
  html = html.replace(/<input\s+id=["']carGallery["'][^>]*>/i, galleryPicker);

  const styles = `<style id="cars-gallery-upload-style">
  .car-upload-box{display:grid;gap:8px;align-content:start}.car-image-file{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
  .car-image-picker{display:flex;align-items:center;gap:10px;min-height:64px;padding:11px 13px;border:1.5px dashed #c9942f;border-radius:12px;background:#fffaf0;cursor:pointer;color:#0b2239}
  .car-image-picker>span:first-child{font-size:28px}.car-image-picker b,.car-image-picker small{display:block}.car-image-picker small{margin-top:2px;color:#6b7782;font-weight:400}
  .car-upload-preview{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:9px;border:1px solid #e1e6ea;border-radius:12px;background:#fff}.car-upload-preview img{width:86px;height:70px;object-fit:cover;border-radius:9px;background:#eef2f4}.car-upload-preview small{color:#697682;flex:1;min-width:140px}
  .car-gallery-preview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.car-gallery-item{position:relative;border:1px solid #e1e6ea;border-radius:10px;overflow:hidden;background:#eef2f4;min-height:82px}.car-gallery-item img{display:block;width:100%;height:88px;object-fit:cover}.car-gallery-remove{position:absolute;top:4px;left:4px;width:28px;height:28px;border:0;border-radius:50%;background:#ffffffed;color:#b42318;font-weight:900;cursor:pointer;box-shadow:0 2px 8px #0002}.car-gallery-status{color:#697682}
  @media(max-width:620px){.car-upload-box.half{grid-column:auto}.car-gallery-preview{grid-template-columns:repeat(3,1fr)}.car-image-picker{min-height:68px}}
  </style>`;
  html = html.replace("</head>", styles + "</head>");

  const script = `<script id="cars-gallery-upload-script">
  (function(){
    var SEP='|||';
    var MAX_EXTRA=5;
    var MAX_SOURCE_BYTES=10*1024*1024;
    var MAX_DATA_CHARS=270000;
    var processing=0;
    function byId(id){return document.getElementById(id)}
    function isImageValue(value){return /^(?:https?:\\/\\/|data:image\\/)/i.test(String(value||'').trim())}
    function splitStored(value){
      var text=String(value||'').trim();if(!text)return [];
      if(text.indexOf(SEP)>=0)return text.split(SEP).map(function(x){return x.trim()}).filter(isImageValue);
      if(/,\\s*(?=(?:data:image\\/|https?:\\/\\/))/i.test(text))return text.split(/,\\s*(?=(?:data:image\\/|https?:\\/\\/))/i).map(function(x){return x.trim()}).filter(isImageValue);
      if(/^data:image\\//i.test(text))return [text];
      return text.split(/[,،\\n]+/).map(function(x){return x.trim()}).filter(isImageValue);
    }
    function linkValues(value){return String(value||'').split(/[\\n,،]+/).map(function(x){return x.trim()}).filter(function(x){return /^https?:\\/\\//i.test(x)})}
    function unique(values){return values.filter(function(v,i,a){return v&&a.indexOf(v)===i})}
    function setBusy(delta){processing=Math.max(0,processing+delta);var btn=byId('saveCarButton');if(btn)btn.disabled=processing>0;}
    function imageFromFile(file){return new Promise(function(resolve,reject){var url=URL.createObjectURL(file),img=new Image();img.onload=function(){URL.revokeObjectURL(url);resolve(img)};img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة المختارة'))};img.src=url;})}
    async function compressImage(file){
      if(!file||!String(file.type||'').startsWith('image/'))throw new Error('اختر ملف صورة صالح');
      if(file.size>MAX_SOURCE_BYTES)throw new Error('حجم الصورة الأصلية أكبر من 10MB');
      var img=await imageFromFile(file);var sourceW=img.naturalWidth||img.width,sourceH=img.naturalHeight||img.height;
      var maxSide=1100,quality=.76,data='';
      for(var attempt=0;attempt<7;attempt++){
        var ratio=Math.min(1,maxSide/Math.max(sourceW,sourceH));var w=Math.max(1,Math.round(sourceW*ratio)),h=Math.max(1,Math.round(sourceH*ratio));
        var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;var ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
        data=canvas.toDataURL('image/jpeg',quality);if(data.length<=MAX_DATA_CHARS)return data;maxSide=Math.max(520,Math.round(maxSide*.82));quality=Math.max(.5,quality-.06);
      }
      if(data.length>MAX_DATA_CHARS)throw new Error('الصورة كبيرة جدًا بعد الضغط؛ اختر صورة أصغر');return data;
    }
    function renderMain(status){
      var hidden=byId('carImage'),wrap=byId('carImagePreviewWrap'),img=byId('carImagePreview'),note=byId('carImageStatus'),url=byId('carImageUrl');if(!hidden||!wrap||!img)return;
      var value=String(hidden.value||'').trim();if(value&&isImageValue(value)){img.src=value;wrap.classList.remove('hidden');if(note)note.textContent=status||'الصورة الرئيسية جاهزة للحفظ';}else{img.removeAttribute('src');wrap.classList.add('hidden');if(note)note.textContent='';}
      if(url&&/^https?:\\/\\//i.test(value))url.value=value;else if(url&&document.activeElement!==url)url.value='';
    }
    function renderGallery(){
      var hidden=byId('carGallery'),box=byId('carGalleryPreview'),note=byId('carGalleryStatus'),urls=byId('carGalleryUrl');if(!hidden||!box)return;
      var values=unique(splitStored(hidden.value)).slice(0,MAX_EXTRA);hidden.value=values.join(SEP);box.innerHTML='';
      values.forEach(function(src,index){var item=document.createElement('div');item.className='car-gallery-item';var img=document.createElement('img');img.src=src;img.alt='صورة إضافية';var remove=document.createElement('button');remove.type='button';remove.className='car-gallery-remove';remove.textContent='×';remove.setAttribute('aria-label','حذف الصورة');remove.addEventListener('click',function(){var current=splitStored(hidden.value);current.splice(index,1);hidden.value=current.join(SEP);renderGallery();});item.appendChild(img);item.appendChild(remove);box.appendChild(item);});
      if(note)note.textContent=values.length?('تم اختيار '+values.length+' من '+MAX_EXTRA+' صور إضافية'):'لم تتم إضافة صور أخرى بعد';
      if(urls&&document.activeElement!==urls)urls.value=values.filter(function(v){return /^https?:\\/\\//i.test(v)}).join('\\n');
    }
    function refreshControls(){renderMain();renderGallery()}
    function install(){
      var form=byId('carForm'),mainHidden=byId('carImage'),mainFile=byId('carImageFile'),mainUrl=byId('carImageUrl'),mainRemove=byId('carImageRemove'),galleryHidden=byId('carGallery'),galleryFiles=byId('carGalleryFiles'),galleryUrl=byId('carGalleryUrl');if(!form||!mainHidden||!mainFile||!galleryHidden||!galleryFiles)return;
      mainFile.addEventListener('change',async function(){var file=mainFile.files&&mainFile.files[0];if(!file)return;setBusy(1);try{mainHidden.value=await compressImage(file);if(mainUrl)mainUrl.value='';renderMain('تم ضغط الصورة الرئيسية وهي جاهزة للنشر');if(typeof toast==='function')toast('تم تحميل الصورة الرئيسية من الاستديو');}catch(e){mainFile.value='';if(typeof toast==='function')toast(e.message);else alert(e.message)}finally{setBusy(-1)}});
      if(mainUrl)mainUrl.addEventListener('input',function(){var value=mainUrl.value.trim();if(value){mainHidden.value=value;mainFile.value='';renderMain('سيتم استخدام رابط الصورة الرئيسية')}else if(/^https?:\\/\\//i.test(mainHidden.value)){mainHidden.value='';renderMain()}});
      if(mainRemove)mainRemove.addEventListener('click',function(){mainHidden.value='';mainFile.value='';if(mainUrl)mainUrl.value='';renderMain();if(typeof toast==='function')toast('تم حذف الصورة الرئيسية من النموذج')});
      galleryFiles.addEventListener('change',async function(){var files=Array.from(galleryFiles.files||[]);if(!files.length)return;var current=splitStored(galleryHidden.value);var room=Math.max(0,MAX_EXTRA-current.length);if(!room){galleryFiles.value='';if(typeof toast==='function')toast('الحد الأقصى 5 صور إضافية');return;}files=files.slice(0,room);setBusy(1);try{for(var i=0;i<files.length;i++){current.push(await compressImage(files[i]));}galleryHidden.value=unique(current).slice(0,MAX_EXTRA).join(SEP);renderGallery();if(typeof toast==='function')toast('تمت إضافة الصور من الاستديو');}catch(e){if(typeof toast==='function')toast(e.message);else alert(e.message)}finally{galleryFiles.value='';setBusy(-1)}});
      if(galleryUrl)galleryUrl.addEventListener('change',function(){var dataImages=splitStored(galleryHidden.value).filter(function(v){return /^data:image\\//i.test(v)});galleryHidden.value=unique(dataImages.concat(linkValues(galleryUrl.value))).slice(0,MAX_EXTRA).join(SEP);renderGallery()});
      form.addEventListener('submit',function(e){if(processing>0){e.preventDefault();e.stopImmediatePropagation();if(typeof toast==='function')toast('انتظر حتى يكتمل تجهيز الصور');}},true);
      var originalNormalize=window.normalizeCar;if(typeof originalNormalize==='function')window.normalizeCar=function(p){var c=originalNormalize(p),parsed=typeof window.parseDescription==='function'?window.parseDescription(p.description):null,raw=parsed&&parsed.meta?parsed.meta['صور']:'';var extra=splitStored(raw);c.gallery=unique([c.image].concat(extra)).filter(Boolean);return c;};
      var originalEdit=window.editCar;if(typeof originalEdit==='function')window.editCar=function(id){originalEdit(id);galleryHidden.value=splitStored(galleryHidden.value).join(SEP);refreshControls();};
      var originalCancel=window.cancelEdit;if(typeof originalCancel==='function')window.cancelEdit=function(){originalCancel();mainHidden.value='';galleryHidden.value='';mainFile.value='';galleryFiles.value='';if(mainUrl)mainUrl.value='';if(galleryUrl)galleryUrl.value='';refreshControls();};
      form.addEventListener('reset',function(){setTimeout(refreshControls,0)});refreshControls();
      setTimeout(function(){if(typeof window.loadCars==='function')window.loadCars();},0);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  })();
  </script>`;

  html = html.replace("</body>", script + "</body>");
  return html;
}

fs.readFileSync = function carsGalleryReadFileSync(filePath, options) {
  const result = originalReadFileSync(filePath, options);
  const encoding = typeof options === "string" ? options : options && options.encoding;
  const isUtf8 = String(encoding || "").toLowerCase().replace("-", "") === "utf8";
  const fileName = path.basename(String(filePath || "")).toLowerCase();
  if (isUtf8 && fileName === "cars.html") return injectCarsGallery(result);
  return result;
};

express.response.send = function carsGallerySend(body) {
  const contentType = String(this.getHeader?.("Content-Type") || "").toLowerCase();
  if (typeof body === "string" && (contentType.includes("text/html") || /^\s*<!doctype html/i.test(body)) && body.includes('id="carForm"')) {
    body = injectCarsGallery(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function carsGalleryStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function carsGalleryStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const target = req.method === "GET" && ["/cars", "/cars/", "/cars.html"].includes(pathname);
    if (!target) return middleware(req, res, next);

    const oldWrite = res.write.bind(res);
    const oldEnd = res.end.bind(res);
    const chunks = [];
    let finished = false;

    function restore() {
      if (finished) return;
      finished = true;
      res.write = oldWrite;
      res.end = oldEnd;
    }

    res.write = function bufferedWrite(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
      if (typeof callback === "function") callback();
      return true;
    };

    res.end = function bufferedEnd(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
      const body = Buffer.concat(chunks).toString("utf8");
      restore();
      const output = injectCarsGallery(body);
      const buffer = Buffer.from(output, "utf8");
      res.removeHeader("ETag");
      res.setHeader("Content-Length", String(buffer.length));
      return oldEnd(buffer, typeof encoding === "function" ? encoding : callback);
    };

    return middleware(req, res, (error) => {
      restore();
      return next(error);
    });
  };
};

module.exports = { injectCarsGallery };
