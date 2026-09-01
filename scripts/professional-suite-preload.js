const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

let dbRef = null;
let prepare = null;
let appRef = null;
let routesInstalled = false;

const ROLE_PERMISSIONS = {
  admin: ['*'],
  accountant: ['accounting.read','accounting.write','orders.read','reports.read'],
  warehouse: ['shipping.read','shipping.scan','shipping.update','packages.print'],
  customer_service: ['customers.read','orders.read','support.read','support.reply','notifications.send','whatsapp.reply'],
  sales_agent: ['customers.read','orders.read','orders.create','quotes.read','quotes.write','products.read','products.write','discounts.write'],
  vehicle_agent: ['cars.read','cars.write','customers.contact','discounts.write']
};

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (['length','name','prototype'].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function tableExists(name) {
  if (!prepare) return false;
  try { return !!prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name); }
  catch { return false; }
}

function ensureSchema() {
  if (!dbRef || !prepare) return;
  dbRef.exec(`
    CREATE TABLE IF NOT EXISTS pro_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed')),
      value REAL NOT NULL DEFAULT 0,
      min_order REAL NOT NULL DEFAULT 0,
      max_discount REAL,
      active INTEGER NOT NULL DEFAULT 1,
      starts_at TEXT,
      ends_at TEXT,
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_checkout_meta (
      order_id INTEGER PRIMARY KEY,
      subtotal REAL NOT NULL DEFAULT 0,
      shipping_method TEXT NOT NULL DEFAULT 'standard',
      shipping_total REAL NOT NULL DEFAULT 0,
      installation_requested INTEGER NOT NULL DEFAULT 0,
      installation_total REAL NOT NULL DEFAULT 0,
      service_fee REAL NOT NULL DEFAULT 0,
      discount_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      coupon_code TEXT,
      payment_method TEXT,
      delivery_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_role TEXT,
      action TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(role,permission)
    );
    CREATE TABLE IF NOT EXISTS admin_2fa (
      user_key TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS address_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'العنوان الرئيسي',
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(id DESC);
    CREATE INDEX IF NOT EXISTS idx_address_book_user ON address_book(user_id,id DESC);
  `);

  const defaults = {
    currency: 'SAR',
    shipping_standard_fee: '0',
    shipping_express_fee: '0',
    installation_fee: '0',
    service_fee_percent: '0',
    checkout_notice: 'يتم احتساب الرسوم وفق إعدادات الإدارة، وأي خدمة بسعر صفر تُراجع مع العميل قبل اعتمادها.'
  };
  const insertSetting = prepare('INSERT OR IGNORE INTO pro_settings(key,value) VALUES(?,?)');
  for (const [key,value] of Object.entries(defaults)) insertSetting.run(key,value);

  const insertPermission = prepare('INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)');
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions) insertPermission.run(role, permission);
  }
}

const sqlitePath = require.resolve('better-sqlite3');
const CurrentDatabase = require(sqlitePath);
function ProfessionalDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) {
    dbRef = db;
    prepare = db.prepare.bind(db);
    setImmediate(ensureSchema);
  }
  return db;
}
ProfessionalDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(ProfessionalDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = ProfessionalDatabase;

function getSetting(key, fallback = '') {
  try { return prepare('SELECT value FROM pro_settings WHERE key=?').get(key)?.value ?? fallback; }
  catch { return fallback; }
}
function setSetting(key, value) {
  prepare(`INSERT INTO pro_settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).run(key, String(value ?? ''));
}
function numSetting(key, fallback = 0) {
  const value = Number(getSetting(key, fallback));
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function normalizeItems(items) {
  const safe = Array.isArray(items) ? items.slice(0,100) : [];
  return safe.filter(item => item && item.name).map(item => {
    const id = Number(item.id || item.product_id) || 0;
    const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
    if (id && tableExists('products_catalog')) {
      const product = prepare('SELECT id,name,category,price,currency,active,stock_quantity FROM products_catalog WHERE id=?').get(id);
      if (product) return {
        id: product.id,
        name: product.name,
        cat: product.category || '',
        qty,
        unitPrice: Math.max(0, Number(product.price) || 0),
        currency: product.currency || 'SAR',
        active: !!product.active,
        stock: Number(product.stock_quantity) || 0
      };
    }
    return {
      id: 0,
      name: clean(item.name,200),
      cat: clean(item.cat || item.category,100),
      qty,
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      currency: clean(item.currency || 'SAR',10)
    };
  });
}

function validateCoupon(code, subtotal) {
  const normalized = clean(code,40).toUpperCase();
  if (!normalized) return { code: null, discount: 0 };
  const coupon = prepare('SELECT * FROM coupons WHERE upper(code)=upper(?)').get(normalized);
  if (!coupon || !coupon.active) throw new Error('كود الخصم غير صالح');
  const now = Date.now();
  if (coupon.starts_at && Date.parse(coupon.starts_at) > now) throw new Error('كود الخصم لم يبدأ بعد');
  if (coupon.ends_at && Date.parse(coupon.ends_at) < now) throw new Error('انتهت صلاحية كود الخصم');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) throw new Error('تم استنفاد كود الخصم');
  if (subtotal < Number(coupon.min_order || 0)) throw new Error('قيمة الطلب أقل من الحد الأدنى للخصم');
  let discount = coupon.discount_type === 'percent' ? subtotal * Number(coupon.value || 0) / 100 : Number(coupon.value || 0);
  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount) || 0);
  discount = Math.max(0, Math.min(subtotal, discount));
  return { code: coupon.code, discount: Number(discount.toFixed(2)), coupon };
}

function checkoutPreview(body = {}) {
  const items = normalizeItems(body.items || []);
  const subtotal = Number(items.reduce((sum,item) => sum + item.unitPrice * item.qty, 0).toFixed(2));
  const shippingMethod = ['standard','express','pickup'].includes(String(body.shippingMethod || body.shipping_method))
    ? String(body.shippingMethod || body.shipping_method) : 'standard';
  const shipping = shippingMethod === 'express' ? numSetting('shipping_express_fee') : shippingMethod === 'pickup' ? 0 : numSetting('shipping_standard_fee');
  const installationRequested = !!(body.installation || body.installationRequested);
  const installation = installationRequested ? numSetting('installation_fee') : 0;
  const servicePercent = numSetting('service_fee_percent');
  const serviceFee = Number(((subtotal + shipping + installation) * servicePercent / 100).toFixed(2));
  const coupon = validateCoupon(body.couponCode || body.coupon_code, subtotal);
  const grandTotal = Number(Math.max(0, subtotal + shipping + installation + serviceFee - coupon.discount).toFixed(2));
  return {
    items, subtotal,
    shippingMethod, shippingTotal: shipping,
    installationRequested, installationTotal: installation,
    serviceFee, discountTotal: coupon.discount,
    couponCode: coupon.code,
    grandTotal,
    currency: getSetting('currency','SAR'),
    notice: getSetting('checkout_notice','')
  };
}

function userKey(req) {
  const id = Number(req.session?.user?.id ?? 0);
  return id > 0 ? `user:${id}` : 'admin:env';
}
function isAdmin(req) { return req.session?.user?.role === 'admin'; }
function requireAdmin(req,res) {
  if (!isAdmin(req)) { res.status(403).json({ error:'صلاحية المدير مطلوبة' }); return false; }
  return true;
}
function requireCustomer(req,res) {
  if (!req.session?.user?.id || req.session.user.role !== 'customer') { res.status(401).json({ error:'يجب تسجيل الدخول بحساب عميل' }); return false; }
  return true;
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8,'0');
  let out = '';
  for (let i=0;i<bits.length;i+=5) out += BASE32[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];
  return out;
}
function base32Decode(value) {
  const input = String(value || '').replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits = '';
  for (const char of input) bits += BASE32.indexOf(char).toString(2).padStart(5,'0');
  const bytes = [];
  for (let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  return Buffer.from(bytes);
}
function totp(secret, at = Date.now()) {
  const counter = Math.floor(at / 30000);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000),0);
  msg.writeUInt32BE(counter >>> 0,4);
  const hmac = crypto.createHmac('sha1',base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length-1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset+1] & 0xff) << 16) | ((hmac[offset+2] & 0xff) << 8) | (hmac[offset+3] & 0xff);
  return String(code % 1000000).padStart(6,'0');
}
function verifyTotp(secret, code) {
  const candidate = String(code || '').replace(/\D/g,'').slice(0,6);
  if (candidate.length !== 6) return false;
  return [-30000,0,30000].some(offset => {
    const expected = totp(secret, Date.now() + offset);
    return crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(expected));
  });
}

function roleCanUseAdminRoute(role, method, route) {
  const r = String(role || '');
  const m = String(method || '').toUpperCase();
  const p = String(route || '');
  if (r === 'warehouse') return m !== 'DELETE' && (/^\/api\/admin\/(shipping|shipping-packages|package|container|trip)/.test(p));
  if (r === 'customer_service') return m !== 'DELETE' && (/^\/api\/admin\/(orders|support|notifications|whatsapp|customers)/.test(p));
  if (r === 'sales_agent') return m !== 'DELETE' && (/^\/api\/admin\/(orders|products|quotes|suppliers|partners)/.test(p));
  return false;
}

function roleAwareHandler(method, route, handler) {
  return function professionalRoleAwareHandler(req,res,next) {
    const originalRole = req.session?.user?.role;
    if (!roleCanUseAdminRoute(originalRole, method, route)) return handler(req,res,next);
    req._proOriginalRole = originalRole;
    req.session.user.role = 'admin';
    let result;
    try { result = handler(req,res,next); }
    catch (error) { req.session.user.role = originalRole; throw error; }
    if (result && typeof result.finally === 'function') return result.finally(() => { if (req.session?.user) req.session.user.role = originalRole; });
    if (req.session?.user) req.session.user.role = originalRole;
    return result;
  };
}

function audit(req, method, route, status) {
  if (!prepare || !tableExists('audit_logs')) return;
  try {
    const user = req.session?.user || {};
    prepare('INSERT INTO audit_logs(user_id,user_role,action,method,path,status_code) VALUES(?,?,?,?,?,?)').run(
      Number(user.id) > 0 ? Number(user.id) : null,
      clean(req._proOriginalRole || user.role || 'guest',40),
      `${method} ${route}`.slice(0,180), method, String(route).slice(0,220), Number(status) || 200
    );
  } catch {}
}

function dashboardData() {
  const q = sql => { try { return prepare(sql).get(); } catch { return {}; } };
  const all = sql => { try { return prepare(sql).all(); } catch { return []; } };
  const today = q(`SELECT COALESCE(SUM(m.grand_total),0) total FROM order_checkout_meta m JOIN orders o ON o.id=m.order_id WHERE date(o.created_at)=date('now','localtime')`).total || 0;
  const month = q(`SELECT COALESCE(SUM(m.grand_total),0) total FROM order_checkout_meta m JOIN orders o ON o.id=m.order_id WHERE strftime('%Y-%m',o.created_at)=strftime('%Y-%m','now','localtime')`).total || 0;
  const stats = {
    salesToday: Number(today), salesMonth: Number(month),
    ordersNew: q('SELECT COUNT(*) c FROM orders WHERE status=0').c || 0,
    ordersOpen: q('SELECT COUNT(*) c FROM orders WHERE status BETWEEN 0 AND 2').c || 0,
    customers: q("SELECT COUNT(*) c FROM users WHERE role='customer'").c || 0,
    lowStock: q('SELECT COUNT(*) c FROM products_catalog WHERE active=1 AND stock_quantity<=5').c || 0,
    suppliers: q('SELECT COUNT(*) c FROM suppliers WHERE active=1').c || 0,
    openSupport: tableExists('support_tickets') ? (q("SELECT COUNT(*) c FROM support_tickets WHERE status IN ('open','in_progress')").c || 0) : 0,
    paid: tableExists('payments') ? (q("SELECT COUNT(*) c FROM payments WHERE status='paid'").c || 0) : 0,
    pendingPayments: tableExists('payments') ? (q("SELECT COUNT(*) c FROM payments WHERE status='pending'").c || 0) : 0
  };
  if (tableExists('shipping_operations')) {
    const profit = q('SELECT COALESCE(SUM(COALESCE(revenue_total,0)-COALESCE(cost_total,0)),0) p FROM shipping_operations').p || 0;
    stats.shippingProfit = Number(profit);
  } else stats.shippingProfit = 0;
  const topProducts = all(`SELECT i.name,SUM(i.qty) qty,ROUND(SUM(i.unit_price*i.qty),2) sales
    FROM order_items i GROUP BY i.name ORDER BY qty DESC LIMIT 8`);
  const lowStockProducts = all('SELECT id,name,category,stock_quantity FROM products_catalog WHERE active=1 AND stock_quantity<=5 ORDER BY stock_quantity ASC LIMIT 12');
  const recentOrders = all(`SELECT o.order_no,o.name,o.city,o.status,o.created_at,COALESCE(m.grand_total,0) total
    FROM orders o LEFT JOIN order_checkout_meta m ON m.order_id=o.id ORDER BY o.id DESC LIMIT 12`);
  const alerts = [];
  if (stats.lowStock) alerts.push({level:'warning',text:`${stats.lowStock} منتجات منخفضة المخزون`});
  const delayed = q("SELECT COUNT(*) c FROM orders WHERE status BETWEEN 0 AND 2 AND datetime(created_at) < datetime('now','-48 hours')").c || 0;
  if (delayed) alerts.push({level:'danger',text:`${delayed} طلبات مفتوحة منذ أكثر من 48 ساعة`});
  if (tableExists('shipping_operations')) {
    const stale = q("SELECT COUNT(*) c FROM shipping_operations WHERE phase!='delivered' AND datetime(COALESCE(updated_at,created_at)) < datetime('now','-48 hours')").c || 0;
    if (stale) alerts.push({level:'warning',text:`${stale} شحنات لم تُحدّث منذ أكثر من يومين`});
  }
  if (!alerts.length) alerts.push({level:'ok',text:'لا توجد تنبيهات تشغيلية حرجة حاليًا'});
  return { stats, topProducts, lowStockProducts, recentOrders, alerts };
}

function installRoutes() {
  if (routesInstalled || !appRef || !prepare) return;
  routesInstalled = true;

  appRef.get('/api/pro/settings', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const rows = prepare('SELECT key,value,updated_at FROM pro_settings ORDER BY key').all();
    res.json({ok:true,settings:Object.fromEntries(rows.map(r=>[r.key,r.value]))});
  });
  appRef.patch('/api/pro/settings', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const allowed = ['shipping_standard_fee','shipping_express_fee','installation_fee','service_fee_percent','checkout_notice','currency'];
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body,key)) setSetting(key, clean(req.body[key],1000));
    res.json({ok:true});
  });
  appRef.post('/api/pro/checkout-preview', (req,res) => {
    try { res.json({ok:true,preview:checkoutPreview(req.body || {})}); }
    catch (error) { res.status(400).json({error:error.message}); }
  });
  appRef.get('/api/pro/dashboard', (req,res) => {
    if (!requireAdmin(req,res)) return;
    res.json({ok:true,...dashboardData()});
  });

  appRef.get('/api/pro/coupons', (req,res) => {
    if (!requireAdmin(req,res)) return;
    res.json({ok:true,coupons:prepare('SELECT * FROM coupons ORDER BY id DESC').all()});
  });
  appRef.post('/api/pro/coupons', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const code = clean(req.body.code,40).toUpperCase();
    const type = req.body.discount_type === 'fixed' ? 'fixed' : 'percent';
    const value = Math.max(0,Number(req.body.value)||0);
    if (!code || !value) return res.status(400).json({error:'الكود وقيمة الخصم مطلوبان'});
    try {
      const info = prepare(`INSERT INTO coupons(code,discount_type,value,min_order,max_discount,starts_at,ends_at,usage_limit)
        VALUES(?,?,?,?,?,?,?,?)`).run(code,type,value,Math.max(0,Number(req.body.min_order)||0),req.body.max_discount===''||req.body.max_discount==null?null:Math.max(0,Number(req.body.max_discount)||0),clean(req.body.starts_at,40)||null,clean(req.body.ends_at,40)||null,req.body.usage_limit===''||req.body.usage_limit==null?null:Math.max(1,Number(req.body.usage_limit)||1));
      res.status(201).json({ok:true,id:Number(info.lastInsertRowid)});
    } catch (error) { res.status(409).json({error:'كود الخصم موجود مسبقًا'}); }
  });
  appRef.patch('/api/pro/coupons/:id', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const active = req.body.active == null ? null : (req.body.active ? 1 : 0);
    const info = prepare('UPDATE coupons SET active=COALESCE(?,active) WHERE id=?').run(active,req.params.id);
    if (!info.changes) return res.status(404).json({error:'كود الخصم غير موجود'});
    res.json({ok:true});
  });

  appRef.get('/api/pro/audit', (req,res) => {
    if (!requireAdmin(req,res)) return;
    res.json({ok:true,logs:prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all()});
  });
  appRef.get('/api/pro/roles', (req,res) => {
    if (!requireAdmin(req,res)) return;
    res.json({ok:true,roles:prepare('SELECT role,permission FROM role_permissions ORDER BY role,permission').all()});
  });
  appRef.get('/api/pro/staff', (req,res) => {
    if (!requireAdmin(req,res)) return;
    res.json({ok:true,staff:prepare("SELECT id,name,phone,email,role,created_at FROM users WHERE role!='customer' ORDER BY id DESC").all()});
  });
  appRef.post('/api/pro/staff', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const name = clean(req.body.name,120), phone = clean(req.body.phone,50), password = String(req.body.password || '');
    const role = clean(req.body.role,40);
    if (!name || !phone || password.length < 8) return res.status(400).json({error:'الاسم والجوال وكلمة مرور من 8 أحرف مطلوبة'});
    if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS,role) || role === 'admin') return res.status(400).json({error:'اختر دورًا وظيفيًا معتمدًا'});
    try {
      const info = prepare('INSERT INTO users(name,phone,password_hash,role,email_verified,must_change_password) VALUES(?,?,?,?,1,0)').run(name,phone,bcrypt.hashSync(password,12),role);
      res.status(201).json({ok:true,id:Number(info.lastInsertRowid)});
    } catch { res.status(409).json({error:'رقم الجوال مستخدم مسبقًا'}); }
  });
  appRef.patch('/api/pro/staff/:id/role', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const role = clean(req.body.role,40);
    if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS,role) || role === 'admin') return res.status(400).json({error:'الدور الوظيفي غير معتمد'});
    const info = prepare('UPDATE users SET role=? WHERE id=?').run(role,req.params.id);
    if (!info.changes) return res.status(404).json({error:'المستخدم غير موجود'});
    res.json({ok:true});
  });

  appRef.get('/api/pro/addresses', (req,res) => {
    if (!requireCustomer(req,res)) return;
    res.json({ok:true,addresses:prepare('SELECT * FROM address_book WHERE user_id=? ORDER BY is_default DESC,id DESC').all(req.session.user.id)});
  });
  appRef.post('/api/pro/addresses', (req,res) => {
    if (!requireCustomer(req,res)) return;
    const label = clean(req.body.label || 'العنوان الرئيسي',80);
    const city = clean(req.body.city,100), address = clean(req.body.address,500), phone = clean(req.body.phone,50);
    if (!city || !address) return res.status(400).json({error:'المدينة والعنوان مطلوبان'});
    const makeDefault = req.body.is_default ? 1 : 0;
    const tx = dbRef.transaction(() => {
      if (makeDefault) prepare('UPDATE address_book SET is_default=0 WHERE user_id=?').run(req.session.user.id);
      return prepare('INSERT INTO address_book(user_id,label,city,address,phone,is_default) VALUES(?,?,?,?,?,?)').run(req.session.user.id,label,city,address,phone,makeDefault);
    });
    const info = tx();
    res.status(201).json({ok:true,id:Number(info.lastInsertRowid)});
  });
  appRef.delete('/api/pro/addresses/:id', (req,res) => {
    if (!requireCustomer(req,res)) return;
    prepare('DELETE FROM address_book WHERE id=? AND user_id=?').run(req.params.id,req.session.user.id);
    res.json({ok:true});
  });

  appRef.get('/api/pro/invoice/:orderNo', (req,res) => {
    const order = prepare('SELECT * FROM orders WHERE order_no=?').get(req.params.orderNo);
    if (!order) return res.status(404).json({error:'الطلب غير موجود'});
    const isOwner = req.session?.user?.id && Number(req.session.user.id) === Number(order.user_id);
    if (!isOwner && !isAdmin(req)) return res.status(403).json({error:'غير مصرح'});
    const items = prepare('SELECT name,category,unit_price,currency,qty FROM order_items WHERE order_id=? ORDER BY id').all(order.id);
    const meta = prepare('SELECT * FROM order_checkout_meta WHERE order_id=?').get(order.id) || null;
    res.json({ok:true,invoice:{invoiceNo:`INV-${order.order_no}`,order,items,meta}});
  });

  appRef.get('/api/pro/security/2fa/status', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const row = prepare('SELECT enabled,created_at,verified_at FROM admin_2fa WHERE user_key=?').get(userKey(req));
    res.json({ok:true,enabled:!!row?.enabled,created_at:row?.created_at||null,verified_at:row?.verified_at||null});
  });
  appRef.post('/api/pro/security/2fa/begin', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const secret = base32Encode(crypto.randomBytes(20));
    prepare(`INSERT INTO admin_2fa(user_key,secret,enabled,created_at,verified_at) VALUES(?,?,0,CURRENT_TIMESTAMP,NULL)
      ON CONFLICT(user_key) DO UPDATE SET secret=excluded.secret,enabled=0,created_at=CURRENT_TIMESTAMP,verified_at=NULL`).run(userKey(req),secret);
    const issuer = encodeURIComponent('AlRifai Shipping');
    const label = encodeURIComponent('AlRifai Admin');
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
    res.json({ok:true,secret,uri});
  });
  appRef.post('/api/pro/security/2fa/enable', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const row = prepare('SELECT secret FROM admin_2fa WHERE user_key=?').get(userKey(req));
    if (!row || !verifyTotp(row.secret,req.body.code)) return res.status(400).json({error:'رمز التحقق غير صحيح'});
    prepare('UPDATE admin_2fa SET enabled=1,verified_at=CURRENT_TIMESTAMP WHERE user_key=?').run(userKey(req));
    res.json({ok:true});
  });
  appRef.post('/api/pro/security/2fa/verify', (req,res) => {
    if (req.session?.user?.role !== 'admin_2fa_pending') return res.status(403).json({error:'لا توجد جلسة تحقق معلقة'});
    const key = req.session.user.id > 0 ? `user:${req.session.user.id}` : 'admin:env';
    const row = prepare('SELECT secret,enabled FROM admin_2fa WHERE user_key=?').get(key);
    if (!row?.enabled || !verifyTotp(row.secret,req.body.code)) return res.status(401).json({error:'رمز التحقق غير صحيح'});
    req.session.user.role = 'admin';
    res.json({ok:true,user:{id:req.session.user.id,role:'admin'}});
  });
  appRef.post('/api/pro/security/2fa/disable', (req,res) => {
    if (!requireAdmin(req,res)) return;
    const row = prepare('SELECT secret,enabled FROM admin_2fa WHERE user_key=?').get(userKey(req));
    if (!row?.enabled || !verifyTotp(row.secret,req.body.code)) return res.status(401).json({error:'رمز التحقق غير صحيح'});
    prepare('UPDATE admin_2fa SET enabled=0 WHERE user_key=?').run(userKey(req));
    res.json({ok:true});
  });
}

function specialOrderHandler(handler) {
  return function professionalOrderWrapper(req,res,next) {
    try {
      const checkout = req.body?.checkout || {};
      const normalized = normalizeItems(req.body?.items || []);
      if (normalized.length) req.body.items = normalized;
      const preview = checkoutPreview({ ...checkout, items: normalized });
      const paymentLabels = {card:'البطاقة البنكية',tamara:'تمارا',tabby:'تابي',bank_transfer:'تحويل بنكي',cash:'نقدي'};
      const shippingLabels = {standard:'شحن قياسي',express:'شحن سريع',pickup:'استلام من المستودع'};
      const extra = [
        checkout.address ? `عنوان التوصيل: ${clean(checkout.address,500)}` : '',
        `طريقة الشحن: ${shippingLabels[preview.shippingMethod] || preview.shippingMethod}`,
        checkout.paymentMethod ? `وسيلة الدفع: ${paymentLabels[checkout.paymentMethod] || clean(checkout.paymentMethod,60)}` : '',
        `إجمالي المنتجات: ${preview.subtotal} ${preview.currency}`,
        `الشحن: ${preview.shippingTotal} ${preview.currency}`,
        preview.installationRequested ? `التركيب: ${preview.installationTotal} ${preview.currency}` : '',
        preview.couponCode ? `كود الخصم: ${preview.couponCode} (-${preview.discountTotal} ${preview.currency})` : '',
        `الإجمالي المتوقع: ${preview.grandTotal} ${preview.currency}`
      ].filter(Boolean).join('\n');
      req.body.details = [clean(req.body.details,3000),extra].filter(Boolean).join('\n');

      const originalJson = res.json.bind(res);
      let persisted = false;
      res.json = function professionalOrderJson(payload) {
        if (!persisted && res.statusCode < 400 && payload?.id) {
          persisted = true;
          try {
            const existing = prepare('SELECT order_id FROM order_checkout_meta WHERE order_id=?').get(payload.id);
            prepare(`INSERT OR REPLACE INTO order_checkout_meta(order_id,subtotal,shipping_method,shipping_total,installation_requested,installation_total,service_fee,discount_total,grand_total,coupon_code,payment_method,delivery_address)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(payload.id,preview.subtotal,preview.shippingMethod,preview.shippingTotal,preview.installationRequested?1:0,preview.installationTotal,preview.serviceFee,preview.discountTotal,preview.grandTotal,preview.couponCode||null,clean(checkout.paymentMethod,40)||null,clean(checkout.address,500)||null);
            if (!existing && preview.couponCode) prepare('UPDATE coupons SET used_count=used_count+1 WHERE upper(code)=upper(?)').run(preview.couponCode);
          } catch (error) { console.error('professional checkout persist error',error.message); }
        }
        return originalJson(payload);
      };
    } catch (error) {
      return res.status(400).json({error:error.message});
    }
    return handler(req,res,next);
  };
}

function adminLoginHandler(handler) {
  return function professionalAdminLogin(req,res,next) {
    const originalJson = res.json.bind(res);
    res.json = function professionalLoginJson(payload) {
      try {
        if (res.statusCode < 400 && payload?.ok && payload?.user?.role === 'admin') {
          const key = Number(payload.user.id) > 0 ? `user:${payload.user.id}` : 'admin:env';
          const two = prepare('SELECT enabled FROM admin_2fa WHERE user_key=?').get(key);
          if (two?.enabled) {
            req.session.user = { id:Number(payload.user.id)||0, role:'admin_2fa_pending' };
            payload = { ...payload, requires2fa:true, user:{...payload.user,role:'admin_2fa_pending'} };
          }
        }
      } catch {}
      return originalJson(payload);
    };
    return handler(req,res,next);
  };
}

const expressPath = require.resolve('express');
const CurrentExpress = require(expressPath);
function ProfessionalExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;

  const originalUse = app.use.bind(app);
  app.use = function professionalUse(...useArgs) {
    const fallback = useArgs.some(arg => typeof arg === 'function' && String(arg).includes('API route not found'));
    if (fallback) installRoutes();
    return originalUse(...useArgs);
  };

  for (const method of ['get','post','patch','put','delete']) {
    const original = app[method].bind(app);
    app[method] = function professionalRouteRegistration(route,...handlers) {
      if (typeof route === 'string' && route.startsWith('/api/')) {
        handlers = handlers.map(handler => typeof handler === 'function' ? roleAwareHandler(method.toUpperCase(),route,handler) : handler);
        if (method !== 'get') {
          const auditMiddleware = (req,res,next) => { res.once('finish',()=>audit(req,method.toUpperCase(),route,res.statusCode)); next(); };
          handlers = [auditMiddleware,...handlers];
        }
      }
      if (method === 'post' && route === '/api/orders') handlers = handlers.map((h,i)=>i===0?h:specialOrderHandler(h));
      if (method === 'post' && route === '/api/auth/login') handlers = handlers.map((h,i)=>i===0?h:adminLoginHandler(h));
      return original(route,...handlers);
    };
  }

  return app;
}
copyFunctionProperties(ProfessionalExpress, CurrentExpress);
require.cache[expressPath].exports = ProfessionalExpress;

module.exports = { checkoutPreview, base32Encode, base32Decode, totp, verifyTotp, ROLE_PERMISSIONS };
require('./professional-ui-runtime-preload.js');
