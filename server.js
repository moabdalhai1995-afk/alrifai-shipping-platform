const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_FILE || path.join(__dirname, "alrifai.db"));

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  product TEXT NOT NULL,
  city TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  details TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  order_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  details TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_no TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  product_total REAL NOT NULL DEFAULT 0,
  shipping_total REAL NOT NULL DEFAULT 0,
  service_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  products TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(rateLimit({windowMs: 15*60*1000, limit: 300, standardHeaders: true, legacyHeaders:false}));
app.use(express.json({limit:"200kb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE_ME_BEFORE_PRODUCTION",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000*60*60*24*7 }
}));
app.use(express.static(__dirname));
function orderNo(){ return "RIF-" + Date.now().toString().slice(-8) + "-" + crypto.randomBytes(2).toString("hex").toUpperCase(); }
function partnerNo(){ return "PAR-" + Date.now().toString().slice(-8); }

app.get("/api/health", (req,res)=>res.json({ok:true, service:"alrifai", version:"3.0.0"}));
app.get("/api/me", (req,res)=>{
  if(!req.session.user) return res.json({authenticated:false});
  const u=db.prepare("SELECT id,name,phone,role,created_at FROM users WHERE id=?").get(req.session.user.id);
  res.json({authenticated:!!u,user:u||null});
});

app.post("/api/auth/register", (req,res)=>{
  const {name,phone,password}=req.body;
  if(!name||!phone||!password||password.length<6) return res.status(400).json({error:"الاسم والجوال وكلمة المرور (6 أحرف على الأقل) مطلوبة"});
  try{
    const hash=bcrypt.hashSync(password,10);
    const info=db.prepare("INSERT INTO users(name,phone,password_hash) VALUES(?,?,?)").run(name.trim(),phone.trim(),hash);
    req.session.user={id:info.lastInsertRowid};
    res.json({ok:true,user:{id:info.lastInsertRowid,name:name.trim(),phone:phone.trim(),role:"customer"}});
  }catch(e){res.status(409).json({error:"رقم الجوال مستخدم مسبقاً"});}
});

app.post("/api/auth/login",(req,res)=>{
  const {phone,password}=req.body;
  const u=db.prepare("SELECT * FROM users WHERE phone=?").get((phone||"").trim());
  if(!u || !bcrypt.compareSync(password||"",u.password_hash)) return res.status(401).json({error:"رقم الجوال أو كلمة المرور غير صحيحة"});
  req.session.user={id:u.id,role:u.role};
  res.json({ok:true,user:{id:u.id,name:u.name,phone:u.phone,role:u.role}});
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.post("/api/orders",(req,res)=>{
  const {name,phone,product,city,qty=1,details=""}=req.body;
  if(!name||!phone||!product||!city) return res.status(400).json({error:"البيانات الأساسية للطلب مطلوبة"});
  const no=orderNo();
  const info=db.prepare(`INSERT INTO orders(order_no,user_id,name,phone,product,city,qty,details)
    VALUES(?,?,?,?,?,?,?,?)`).run(no,req.session.user?.id||null,name,phone,product,city,Math.max(1,Number(qty)||1),details);
  res.status(201).json({ok:true,orderNo:no,id:info.lastInsertRowid,status:0});
});

app.get("/api/orders/:orderNo",(req,res)=>{
  const o=db.prepare("SELECT order_no,name,phone,product,city,qty,details,status,created_at FROM orders WHERE order_no=?").get(req.params.orderNo);
  if(!o) return res.status(404).json({error:"لم يتم العثور على الطلب"});
  res.json({ok:true,order:o});
});

app.get("/api/my-orders",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const rows=db.prepare("SELECT order_no,product,city,qty,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC").all(req.session.user.id);
  res.json({ok:true,orders:rows});
});

app.post("/api/partners",(req,res)=>{
  const {company,name,phone,city="",products="",details=""}=req.body;
  if(!company||!name||!phone) return res.status(400).json({error:"البيانات الأساسية للشراكة مطلوبة"});
  const ref=partnerNo();
  db.prepare(`INSERT INTO partners(ref_no,company,name,phone,city,products,details) VALUES(?,?,?,?,?,?,?)`)
    .run(ref,company,name,phone,city,products,details);
  res.status(201).json({ok:true,refNo:ref});
});


app.get("/api/profile",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const u=db.prepare("SELECT id,name,phone,role,created_at FROM users WHERE id=?").get(req.session.user.id);
  res.json({ok:true,user:u});
});

app.put("/api/profile",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const {name}=req.body;
  if(!name || !name.trim()) return res.status(400).json({error:"الاسم مطلوب"});
  db.prepare("UPDATE users SET name=? WHERE id=?").run(name.trim(),req.session.user.id);
  res.json({ok:true});
});

app.get("/api/admin/stats",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const users=db.prepare("SELECT COUNT(*) c FROM users WHERE role='customer'").get().c;
  const orders=db.prepare("SELECT COUNT(*) c FROM orders").get().c;
  const pending=db.prepare("SELECT COUNT(*) c FROM orders WHERE status<3").get().c;
  const partners=db.prepare("SELECT COUNT(*) c FROM partners").get().c;
  res.json({ok:true,stats:{users,orders,pending,partners}});
});

app.patch("/api/admin/orders/:orderNo/status",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const status=Math.max(0,Math.min(3,Number(req.body.status)));
  const info=db.prepare("UPDATE orders SET status=? WHERE order_no=?").run(status,req.params.orderNo);
  if(!info.changes) return res.status(404).json({error:"الطلب غير موجود"});
  res.json({ok:true});
});

app.get("/api/admin/partners",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  res.json({ok:true,partners:db.prepare("SELECT * FROM partners ORDER BY id DESC").all()});
});



app.get("/api/my-quotes",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const rows=db.prepare(`SELECT q.quote_no,q.product_total,q.shipping_total,q.service_fee,q.total,q.status,q.notes,q.created_at,
    o.order_no,o.product,o.city,o.id order_id
    FROM quotes q JOIN orders o ON o.id=q.order_id
    WHERE o.user_id=? ORDER BY q.id DESC`).all(req.session.user.id);
  res.json({ok:true,quotes:rows});
});

app.post("/api/quotes/:quoteNo/accept",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const q=db.prepare(`SELECT q.*,o.user_id,o.id order_id,o.order_no FROM quotes q JOIN orders o ON o.id=q.order_id WHERE q.quote_no=?`).get(req.params.quoteNo);
  if(!q || q.user_id!==req.session.user.id) return res.status(404).json({error:"عرض السعر غير موجود"});
  db.prepare("UPDATE quotes SET status='accepted' WHERE id=?").run(q.id);
  db.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
    .run(req.session.user.id,q.order_id,"تم اعتماد عرض السعر","تم اعتماد عرض "+q.quote_no+" ويمكنك متابعة الدفع.");
  res.json({ok:true});
});

app.post("/api/payments/checkout",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const {quoteNo,method}=req.body;
  const q=db.prepare(`SELECT q.*,o.id order_id,o.user_id,o.order_no FROM quotes q JOIN orders o ON o.id=q.order_id WHERE q.quote_no=?`).get(quoteNo);
  if(!q || q.user_id!==req.session.user.id) return res.status(404).json({error:"عرض السعر غير موجود"});
  if(q.status!=="accepted") return res.status(400).json({error:"يجب اعتماد عرض السعر أولاً"});
  const allowed=["card","tamara","tabby","bank_transfer"];
  if(!allowed.includes(method)) return res.status(400).json({error:"طريقة الدفع غير مدعومة"});
  const paymentNo="PAY-"+Date.now().toString().slice(-10);
  db.prepare("INSERT INTO payments(payment_no,order_id,method,amount,status) VALUES(?,?,?,?,?)")
    .run(paymentNo,q.order_id,method,q.total,"pending");
  // Real gateway integration must happen here using provider credentials/webhooks.
  const message=method==="bank_transfer" ? "تم إنشاء طلب تحويل بنكي وسيتم تأكيده بعد مراجعة الإدارة." :
    "تم تجهيز عملية الدفع. اربط بوابة الدفع الرسمية لإكمال العملية إلكترونياً.";
  db.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
    .run(req.session.user.id,q.order_id,"عملية دفع جديدة",message);
  res.status(201).json({ok:true,paymentNo,amount:q.total,status:"pending",method,message});
});

app.get("/api/my-payments",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const rows=db.prepare(`SELECT p.payment_no,p.amount,p.method,p.status,p.created_at,o.order_no
    FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.user_id=? ORDER BY p.id DESC`).all(req.session.user.id);
  res.json({ok:true,payments:rows});
});

app.get("/api/notifications",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  const rows=db.prepare(`SELECT id,title,body,read_at,created_at FROM notifications
    WHERE user_id=? ORDER BY id DESC LIMIT 30`).all(req.session.user.id);
  res.json({ok:true,notifications:rows});
});

app.patch("/api/notifications/:id/read",(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?")
    .run(req.params.id,req.session.user.id);
  res.json({ok:true});
});

app.get("/api/admin/payments",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  res.json({ok:true,payments:db.prepare(`SELECT p.*,o.order_no,o.name customer_name FROM payments p JOIN orders o ON o.id=p.order_id ORDER BY p.id DESC`).all()});
});

app.patch("/api/admin/payments/:paymentNo/status",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const allowed=["pending","paid","failed","refunded"];
  const status=req.body.status;
  if(!allowed.includes(status)) return res.status(400).json({error:"حالة الدفع غير صحيحة"});
  const info=db.prepare("UPDATE payments SET status=? WHERE payment_no=?").run(status,req.params.paymentNo);
  if(!info.changes) return res.status(404).json({error:"عملية الدفع غير موجودة"});
  res.json({ok:true});
});

app.get("/api/catalog",(req,res)=>{
  const rows=db.prepare(`SELECT p.id,p.name,p.category,p.description,p.price,p.currency,p.supplier_id,s.name supplier_name
    FROM products_catalog p LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE p.active=1 ORDER BY p.id DESC`).all();
  res.json({ok:true,products:rows});
});

app.post("/api/admin/suppliers",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const {name,phone="",city="",details=""}=req.body;
  if(!name) return res.status(400).json({error:"اسم الشريك مطلوب"});
  const info=db.prepare("INSERT INTO suppliers(name,phone,city,details) VALUES(?,?,?,?)").run(name,phone,city,details);
  res.status(201).json({ok:true,id:info.lastInsertRowid});
});

app.get("/api/admin/suppliers",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  res.json({ok:true,suppliers:db.prepare("SELECT * FROM suppliers ORDER BY id DESC").all()});
});

app.post("/api/admin/products",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const {supplier_id=null,name,category="",description="",price=0,currency="SAR"}=req.body;
  if(!name) return res.status(400).json({error:"اسم المنتج مطلوب"});
  const info=db.prepare(`INSERT INTO products_catalog(supplier_id,name,category,description,price,currency)
    VALUES(?,?,?,?,?,?)`).run(supplier_id||null,name,category,description,Number(price)||0,currency);
  res.status(201).json({ok:true,id:info.lastInsertRowid});
});

app.patch("/api/admin/products/:id",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const {name,category,description,price,currency,active}=req.body;
  const info=db.prepare(`UPDATE products_catalog SET name=COALESCE(?,name),category=COALESCE(?,category),
    description=COALESCE(?,description),price=COALESCE(?,price),currency=COALESCE(?,currency),active=COALESCE(?,active)
    WHERE id=?`).run(name,category,description,price===undefined?null:Number(price),currency,active===undefined?null:Number(active),req.params.id);
  if(!info.changes) return res.status(404).json({error:"المنتج غير موجود"});
  res.json({ok:true});
});

app.delete("/api/admin/products/:id",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  db.prepare("UPDATE products_catalog SET active=0 WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/admin/quotes",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const {order_id,product_total=0,shipping_total=0,service_fee=0,notes=""}=req.body;
  const order=db.prepare("SELECT id FROM orders WHERE id=?").get(order_id);
  if(!order) return res.status(404).json({error:"الطلب غير موجود"});
  const pt=Number(product_total)||0, st=Number(shipping_total)||0, sf=Number(service_fee)||0, total=pt+st+sf;
  const qno="Q-"+Date.now().toString().slice(-9);
  const info=db.prepare(`INSERT INTO quotes(quote_no,order_id,product_total,shipping_total,service_fee,total,notes)
    VALUES(?,?,?,?,?,?,?)`).run(qno,order_id,pt,st,sf,total,notes);
  res.status(201).json({ok:true,quoteNo:qno,total,id:info.lastInsertRowid});
});

app.get("/api/admin/quotes",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  const rows=db.prepare(`SELECT q.*,o.order_no,o.name customer_name,o.product
    FROM quotes q JOIN orders o ON o.id=q.order_id ORDER BY q.id DESC`).all();
  res.json({ok:true,quotes:rows});
});

app.post("/api/setup/admin", (req,res)=>{
  if(!process.env.SETUP_KEY || req.headers["x-setup-key"] !== process.env.SETUP_KEY)
    return res.status(403).json({error:"مفتاح الإعداد غير صحيح"});
  const {name,phone,password}=req.body;
  if(!name||!phone||!password||password.length<8) return res.status(400).json({error:"بيانات المدير غير مكتملة"});
  const exists=db.prepare("SELECT id FROM users WHERE phone=?").get(phone.trim());
  if(exists) return res.status(409).json({error:"رقم الجوال مستخدم مسبقاً"});
  const hash=bcrypt.hashSync(password,12);
  const info=db.prepare("INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,'admin')").run(name.trim(),phone.trim(),hash);
  res.status(201).json({ok:true,id:info.lastInsertRowid});
});

app.post("/api/admin/seed",(req,res)=>{
  if(process.env.NODE_ENV === "production" || process.env.ENABLE_SEED_ADMIN !== "1") return res.status(403).json({error:"تعطيل إنشاء المدير التجريبي"});
  const phone="0500000000", password="Admin123!";
  const exists=db.prepare("SELECT id FROM users WHERE phone=?").get(phone);
  if(exists) return res.json({ok:true,phone,password});
  const hash=bcrypt.hashSync(password,10);
  db.prepare("INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,'admin')").run("مدير المنصة",phone,hash);
  res.json({ok:true,phone,password});
});

app.get("/api/admin/orders",(req,res)=>{
  if(!req.session.user || req.session.user.role!=="admin") return res.status(403).json({error:"صلاحية المدير مطلوبة"});
  res.json({ok:true,orders:db.prepare("SELECT * FROM orders ORDER BY id DESC").all()});
});

app.use((req,res,next)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"API route not found"});
  next();
});
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`AlRifai platform running on http://localhost:${PORT}`));
