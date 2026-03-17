import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import pkg from "pg";
const { Pool } = pkg;
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import webpush from "web-push";
import http from "http";
import { Server } from "socket.io";
import { AsyncLocalStorage } from "async_hooks";

const transactionStorage = new AsyncLocalStorage<any>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB Connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_nCe9cEvZHW2q@ep-bold-sky-adj7i2ge-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Global error handlers to prevent process crash
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// Helper function to execute queries like better-sqlite3
const db = {
  prepare: (query: string) => {
    // Convert SQLite ? to PostgreSQL $1, $2, etc.
    let pgQuery = query;
    let paramCount = 1;
    while (pgQuery.includes("?")) {
      pgQuery = pgQuery.replace("?", `$${paramCount}`);
      paramCount++;
    }

    return {
      get: async (...params: any[]) => {
        const client = transactionStorage.getStore() || pool;
        const sanitizedParams = params.map((p) => (p === undefined ? null : p));
        if (params.includes(undefined)) {
          console.warn("Query with undefined param (get):", pgQuery, params);
        }
        const result = await client.query(pgQuery, sanitizedParams);
        return result.rows[0];
      },
      all: async (...params: any[]) => {
        const client = transactionStorage.getStore() || pool;
        const sanitizedParams = params.map((p) => (p === undefined ? null : p));
        if (params.includes(undefined)) {
          console.warn("Query with undefined param (all):", pgQuery, params);
        }
        const result = await client.query(pgQuery, sanitizedParams);
        return result.rows;
      },
      run: async (...params: any[]) => {
        const client = transactionStorage.getStore() || pool;
        const sanitizedParams = params.map((p) => (p === undefined ? null : p));
        if (params.includes(undefined)) {
          console.warn("Query with undefined param (run):", pgQuery, params);
        }
        const result = await client.query(pgQuery, sanitizedParams);
        return {
          lastInsertRowid: result.rows[0]?.id || 0,
          changes: result.rowCount,
        };
      },
    };
  },
  exec: async (query: string) => {
    const client = transactionStorage.getStore() || pool;
    await client.query(query);
  },
  transaction: (fn: Function) => {
    return async (...args: any[]) => {
      const client = await pool.connect();
      return transactionStorage.run(client, async () => {
        try {
          await client.query("BEGIN");
          const result = await fn(...args);
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      });
    };
  },
};

// Use memory storage for multer to get buffer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Initialize DB
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Unhandled Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Global Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global Logger
app.use((req, res, next) => {
  console.log(`[Global Debug] Request: ${req.method} ${req.url}`);
  next();
});

// Telegram Webhook - Extremely permissive
app.all("/api/telegram-webhook*", (req, res) => {
  console.log(`[Telegram Debug] Webhook reached! URL: ${req.url}`);
  res.status(200).send('OK');
});

// Async handler wrapper for Express routes
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`Error in ${req.method} ${req.url}:`, err);
    next(err);
  });
};

// Helper to validate integer IDs
const isValidId = (id: any): boolean => {
  if (id === undefined || id === null || id === "undefined" || id === "null")
    return false;
  const n = Number(id);
  return Number.isInteger(n) && n > 0;
};
// Test route
app.get("/test", (req, res) => {
  res.send("Server is running!");
});

// Health check
app.get("/api/health", asyncHandler(async (req: any, res: any) => {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - start;
    res.json({ 
      status: "ok", 
      db: "connected", 
      dbLatency: `${dbLatency}ms`,
      env: process.env.NODE_ENV || "development" 
    });
  } catch (err: any) {
    console.error("Health check DB error:", err);
    res.status(500).json({ 
      status: "error", 
      db: "disconnected", 
      error: err.message,
      env: process.env.NODE_ENV || "development"
    });
  }
}));

// API Routes

// Web Push Configuration
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Helper to send push
async function sendPushNotification(userId: number, title: string, body: string) {
  try {
    const subscriptions = await db
      .prepare("SELECT subscription FROM push_subscriptions WHERE user_id = ?")
      .all(userId);
    
    const promises = subscriptions.map(async (sub: any) => {
      try {
        const subscription = JSON.parse(sub.subscription);
        await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid
          await db.prepare("DELETE FROM push_subscriptions WHERE subscription = ?").run(sub.subscription);
        } else {
          console.error("[Push Debug] Error sending notification:", err);
        }
      }
    });
    
    await Promise.all(promises);
  } catch (err) {
    console.error("[Push Debug] Error fetching subscriptions:", err);
  }
}

// Helper to send push to all admins
async function sendPushToAdmins(title: string, body: string) {
  try {
    const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    const promises = admins.map((admin: any) => sendPushNotification(admin.id, title, body));
    await Promise.all(promises);
  } catch (err) {
    console.error("[Push Debug] Error sending push to admins:", err);
  }
}

// Push Routes
app.post("/api/push/subscribe", asyncHandler(async (req: any, res: any) => {
  const { user_id, subscription } = req.body;
  if (!isValidId(user_id) || !subscription) {
    return res.status(400).json({ error: "بيانات غير صالحة" });
  }

  const subStr = JSON.stringify(subscription);
  
  // Check if subscription already exists for this user
  const existing = await db.prepare("SELECT id FROM push_subscriptions WHERE user_id = ? AND subscription = ?").get(user_id, subStr);
  
  if (!existing) {
    await db.prepare("INSERT INTO push_subscriptions (user_id, subscription) VALUES (?, ?)")
      .run(user_id, subStr);
  }

  res.json({ success: true });
}));

app.get("/api/push/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Email Helper
async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) {
  console.log(`[Email Debug] Attempting to send email to: ${to}`);
  console.log(`[Email Debug] Subject: ${subject}`);
  console.log(`[Email Debug] GMAIL_USER: ${process.env.GMAIL_USER}`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("GMAIL_USER or GMAIL_PASS is not set in environment variables");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    connectionTimeout: 20000, 
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });

  try {
    const info = await transporter.sendMail({
      from: `"دعم علي كاش" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Email Debug] Email sent successfully! Message ID: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error("[Email Debug] Nodemailer Error:", error);
    throw new Error(`فشل الاتصال بـ Gmail: ${error.message}. تأكد من استخدام "كلمة مرور التطبيق" (App Password) من 16 حرفاً.`);
  }
}

// Auth Routes
app.post("/api/auth/register", asyncHandler(async (req: any, res: any) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminEmails = process.env.ADMIN_EMAIL
      ? process.env.ADMIN_EMAIL.split(",").map((e) => e.trim())
      : [];
    const role = adminEmails.includes(email) ? "admin" : "user";

    let a_code;
    let isUnique = false;
    while (!isUnique) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      a_code = '';
      for (let i = 0; i < 8; i++) {
        a_code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await db
        .prepare("SELECT id FROM users WHERE a_code = ?")
        .get(a_code);
      if (!existing) isUnique = true;
    }

    const result = await db
      .prepare(
        "INSERT INTO users (name, email, password, plain_password, role, a_code, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      )
      .run(name, email, hashedPassword, password, role, a_code);
    const user = (await db
      .prepare(
        "SELECT id, name, email, balance, role, a_code, preferred_currency, created_at FROM users WHERE id = ?",
      )
      .get(result.lastInsertRowid)) as any;

    const io = req.app.get("io");
    if (io) io.emit("user_registered", user);

    res.json(user);
  } catch (err: any) {
    if (
      err.message.includes("UNIQUE constraint failed") ||
      err.message.includes("duplicate key value")
    ) {
      return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
    }
    res.status(500).json({ error: "حدث خطأ أثناء التسجيل" });
  }
}));

app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "البريد وكلمة السر مطلوبان" });

  const user = (await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email)) as any;

  // Check if user exists
  if (!user) {
    return res
      .status(401)
      .json({ error: "البريد الإلكتروني غير مسجل، الرجاء إنشاء حساب جديد" });
  }

  // Check if user has a password (in case they used OAuth before)
  if (!user.password) {
    return res
      .status(401)
      .json({
        error: "هذا الحساب لا يمتلك كلمة سر، يرجى استخدام استعادة كلمة المرور",
      });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "كلمة المرور خاطئة" });
  }

  // Generate 5-digit login code
  // const loginCode = Math.floor(10000 + Math.random() * 90000).toString();
  // const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  // await db
  //   .prepare(
  //     "UPDATE users SET login_code = ?, login_code_expires = ? WHERE id = ?",
  //   )
  //   .run(loginCode, expires.toISOString(), user.id);

  // // Send Email
  // try {
  //   await sendEmail({
  //     to: email,
  //     subject: "كود التحقق لتسجيل الدخول",
  //     html: `
  //       <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
  //         <h2 style="color: #4f46e5;">تسجيل الدخول</h2>
  //         <p style="font-size: 16px; color: #333;">لقد طلبت تسجيل الدخول إلى حسابك.</p>
  //         <p style="font-size: 16px; color: #333;">كود التحقق الخاص بك هو:</p>
  //         <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 200px;">
  //           <h1 style="color: #111827; margin: 0; font-size: 32px; letter-spacing: 5px;">${loginCode}</h1>
  //         </div>
  //         <p style="color: #6b7280; font-size: 14px;">هذا الكود صالح لمدة 10 دقائق فقط.</p>
  //         <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">إذا لم تطلب هذا الكود، يرجى تجاهل هذه الرسالة.</p>
  //       </div>
  //     `,
  //   });
  // } catch (err) {
  //   console.error("Email error during login:", err);
  //   return res.status(500).json({ error: `فشل في إرسال البريد الإلكتروني: ${err instanceof Error ? err.message : 'خطأ غير معروف'}` });
  // }

  // res.json({ require_code: true, email: user.email });
  
  // Return user directly
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    balance: user.balance,
    role: user.role,
    a_code: user.a_code,
    preferred_currency: user.preferred_currency,
    created_at: user.created_at
  });
}));

app.post("/api/auth/verify-login", asyncHandler(async (req: any, res: any) => {
  const { email, code } = req.body;

  const user = (await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email)) as any;
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

  if (user.login_code !== code) {
    return res.status(400).json({ error: "الكود غير صحيح" });
  }

  if (new Date(user.login_code_expires) < new Date()) {
    return res.status(400).json({ error: "الكود منتهي الصلاحية" });
  }

  // Clear code
  await db
    .prepare(
      "UPDATE users SET login_code = NULL, login_code_expires = NULL WHERE id = ?",
    )
    .run(user.id);

  if (!user.a_code) {
    let a_code;
    let isUnique = false;
    while (!isUnique) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      a_code = '';
      for (let i = 0; i < 8; i++) {
        a_code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await db
        .prepare("SELECT id FROM users WHERE a_code = ?")
        .get(a_code);
      if (!existing) isUnique = true;
    }
    await db
      .prepare("UPDATE users SET a_code = ? WHERE id = ?")
      .run(a_code, user.id);
    user.a_code = a_code;
  }

  const now = new Date().toISOString();
  await db
    .prepare("UPDATE users SET last_login = ? WHERE id = ?")
    .run(now, user.id);
  user.last_login = now;

  const io = req.app.get("io");
  if (io)
    io.emit("user_active", {
      id: user.id,
      last_login: now,
      name: user.name,
      a_code: user.a_code,
      balance: user.balance,
      preferred_currency: user.preferred_currency,
    });

  const {
    password: _,
    reset_code: __,
    reset_expires: ___,
    login_code: ____,
    login_code_expires: _____,
    ...userWithoutPassword
  } = user;
  res.json(userWithoutPassword);
}));

app.post("/api/auth/forgot-password", asyncHandler(async (req: any, res: any) => {
  const { email } = req.body;
  const user = (await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email)) as any;
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await db
    .prepare("UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?")
    .run(resetCode, expires.toISOString(), user.id);

  // Send Email (Fire and forget to prevent blocking)
  sendEmail({
    to: email,
    subject: "كود إعادة تعيين كلمة السر",
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
        <h2 style="color: #4f46e5;">إعادة تعيين كلمة السر</h2>
        <p style="font-size: 16px; color: #333;">لقد طلبت إعادة تعيين كلمة السر الخاصة بك.</p>
        <p style="font-size: 16px; color: #333;">كود إعادة التعيين الخاص بك هو:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 200px;">
          <h1 style="color: #111827; margin: 0; font-size: 32px; letter-spacing: 5px;">${resetCode}</h1>
        </div>
        <p style="color: #6b7280; font-size: 14px;">هذا الكود صالح لمدة 15 دقيقة فقط.</p>
        <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">إذا لم تطلب هذا الكود، يرجى تجاهل هذه الرسالة.</p>
      </div>
    `,
  }).catch(err => console.error("Background email error:", err));
  
  res.json({ success: true });
}));

app.post("/api/auth/reset-password", asyncHandler(async (req: any, res: any) => {
  const { email, code, newPassword } = req.body;
  const user = (await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email)) as any;

  if (!user || user.reset_code !== code)
    return res.status(400).json({ error: "الكود غير صحيح" });

  const expires = new Date(user.reset_expires);
  if (expires < new Date())
    return res.status(400).json({ error: "انتهت صلاحية الكود" });

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db
    .prepare(
      "UPDATE users SET password = ?, plain_password = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?",
    )
    .run(hashedPassword, newPassword, user.id);

  res.json({ success: true });
}));

app.post("/api/auth/send-edit-code", asyncHandler(async (req: any, res: any) => {
  try {
    const { email } = req.body;
    const user = (await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email)) as any;
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 10 * 60000).toISOString();

    await db
      .prepare("UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?")
      .run(code, expires, user.id);

    // Send Email (Fire and forget to prevent blocking)
    sendEmail({
      to: email,
      subject: "كود التحقق لتعديل الملف الشخصي",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #4f46e5;">تعديل الملف الشخصي</h2>
          <p style="font-size: 16px; color: #333;">لقد طلبت تعديل بيانات ملفك الشخصي.</p>
          <p style="font-size: 16px; color: #333;">كود التحقق الخاص بك هو:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 200px;">
            <h1 style="color: #111827; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">هذا الكود صالح لمدة 10 دقائق فقط.</p>
          <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">إذا لم تطلب هذا الكود، يرجى تجاهل هذه الرسالة.</p>
        </div>
      `,
    }).catch(err => console.error("Background email error (edit code):", err));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Send edit code error:", err);
    res.status(500).json({ error: err.message || "حدث خطأ أثناء إرسال الكود" });
  }
}));

app.post("/api/auth/verify-edit-code", asyncHandler(async (req: any, res: any) => {
  try {
    const { email, code } = req.body;
    const user = (await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email)) as any;

    if (!user || user.reset_code !== code)
      return res.status(400).json({ error: "الكود غير صحيح" });

    const expires = new Date(user.reset_expires);
    if (expires < new Date())
      return res.status(400).json({ error: "انتهت صلاحية الكود" });

    // Clear code after verification
    await db
      .prepare(
        "UPDATE users SET reset_code = NULL, reset_expires = NULL WHERE id = ?",
      )
      .run(user.id);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Verify edit code error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء التحقق من الكود" });
  }
}));

app.put("/api/auth/update-profile", asyncHandler(async (req: any, res: any) => {
  try {
    const { id, name, email, password } = req.body;

    // Check if email is already taken by another user
    const existingUser = await db
      .prepare("SELECT * FROM users WHERE email = ? AND id != ?")
      .get(email, id);
    if (existingUser)
      return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });

    let query =
      "UPDATE users SET name = ?, email = ?, is_modified = 1 WHERE id = ?";
    let params = [name, email, id];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query =
        "UPDATE users SET name = ?, email = ?, password = ?, plain_password = ?, is_modified = 1 WHERE id = ?";
      params = [name, email, hashedPassword, password, id];
    }

    await db.prepare(query).run(...params);

    // Notify admins
    const io = req.app.get("io");
    if (io) io.emit("user_updated", { userId: id });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث الملف الشخصي" });
  }
}));

app.post("/api/auth/restore", asyncHandler(async (req: any, res: any) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing user ID" });

  const user = (await db
    .prepare(
      "SELECT id, name, email, balance, role, a_code, preferred_currency FROM users WHERE id = ?",
    )
    .get(id)) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user);
}));

app.get("/api/users/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid user ID" });
  const user = await db
    .prepare(
      "SELECT id, name, email, balance, role, a_code, preferred_currency FROM users WHERE id = ?",
    )
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
}));

let cachedRates: { syp: number; try: number } | null = null;
let lastFetchTime = 0;

async function getRates() {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime < 3600000)) {
    return cachedRates;
  }

  try {
    // Try multiple sources for accuracy
    const sources = [
      "https://api.exchangerate-api.com/v4/latest/USD",
      "https://api.exchangerate.host/latest?base=USD",
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      "https://open.er-api.com/v6/latest/USD"
    ];

    let response;
    let data;
    let rates;

    for (const source of sources) {
      try {
        console.log(`[Rates] Attempting to fetch from: ${source}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(source, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
          rates = data.rates || data.usd || data;
          if (rates && (rates.TRY || rates.try) && (rates.SYP || rates.syp)) {
            response = res;
            console.log(`[Rates] Successfully fetched from: ${source}`);
            break;
          }
        }
      } catch (e) {
        console.error(`[Rates] Failed to fetch from ${source}:`, e);
      }
    }
    
    if (!rates) throw new Error("Failed to fetch rates from all sources");
    
    const tryRate = rates.TRY || rates.try;
    const sypRate = rates.SYP || rates.syp;
    
    console.log(`Fetched rates - TRY: ${tryRate}, SYP: ${sypRate}`);
    
    const sypMode = await db.prepare("SELECT value FROM settings WHERE key = 'syp_rate_mode'").get() as any;
    const tryMode = await db.prepare("SELECT value FROM settings WHERE key = 'try_rate_mode'").get() as any;

    let finalTry = tryRate;
    if (tryMode?.value === 'manual') {
        const trySetting = await db.prepare("SELECT value FROM settings WHERE key = 'try_rate'").get() as any;
        finalTry = parseFloat(trySetting?.value || "32");
    } else if (tryRate) {
        const tryOffset = await db.prepare("SELECT value FROM settings WHERE key = 'try_offset'").get() as any;
        const offset = parseFloat(tryOffset?.value || "0");
        finalTry = tryRate * (1 + offset / 100);
        await db.prepare("UPDATE settings SET value = ? WHERE key = 'try_rate'").run(finalTry.toString());
    }

    let finalSyp = sypRate;
    if (sypMode?.value === 'manual') {
        const sypSetting = await db.prepare("SELECT value FROM settings WHERE key = 'syp_rate'").get() as any;
        finalSyp = parseFloat(sypSetting?.value || "15000");
    } else if (sypRate) {
        const sypOffset = await db.prepare("SELECT value FROM settings WHERE key = 'syp_offset'").get() as any;
        const offset = parseFloat(sypOffset?.value || "0");
        finalSyp = sypRate * (1 + offset / 100);
        await db.prepare("UPDATE settings SET value = ? WHERE key = 'syp_rate'").run(finalSyp.toString());
    }

    cachedRates = { syp: finalSyp || 15000, try: finalTry || 32 };
    lastFetchTime = now;
    return cachedRates;
  } catch (error) {
    console.error("Error fetching automatic exchange rates:", error);
  }

  const sypSetting = await db.prepare("SELECT value FROM settings WHERE key = 'syp_rate'").get() as any;
  const trySetting = await db.prepare("SELECT value FROM settings WHERE key = 'try_rate'").get() as any;
  
  return { 
    syp: parseFloat(sypSetting?.value || "15000"), 
    try: parseFloat(trySetting?.value || "32") 
  };
}

function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: { syp: number; try: number },
) {
  const fromMap: Record<string, string> = {
    $: "$",
    SYP: "SYR",
    TRY: "TRY",
    "ل.س": "SYR",
    "ل.ت": "TRY",
    SYR: "SYR",
  };
  const toMap: Record<string, string> = {
    $: "$",
    SYP: "SYR",
    TRY: "TRY",
    "ل.س": "SYR",
    "ل.ت": "TRY",
    SYR: "SYR",
  };

  const normalizedFrom = fromMap[from] || from;
  const normalizedTo = toMap[to] || to;

  if (normalizedFrom === normalizedTo) return amount;

  let inUsd = amount;
  if (normalizedFrom === "SYR") inUsd = amount / rates.syp;
  else if (normalizedFrom === "TRY") inUsd = amount / rates.try;

  let result = inUsd;
  if (normalizedTo === "SYR") result = inUsd * rates.syp;
  else if (normalizedTo === "TRY") result = inUsd * rates.try;
  
  return Math.round(result * 100) / 100;
}

app.post("/api/users/:id/currency", asyncHandler(async (req: any, res: any) => {
  const { currency } = req.body;
  const userId = req.params.id;
  if (!isValidId(userId))
    return res.status(400).json({ error: "Invalid user ID" });

  const user = (await db
    .prepare("SELECT balance, preferred_currency FROM users WHERE id = ?")
    .get(userId)) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.preferred_currency !== currency) {
    const rates = await getRates();
    const newBalance = convertCurrency(
      user.balance,
      user.preferred_currency,
      currency,
      rates,
    );
    await db
      .prepare(
        "UPDATE users SET preferred_currency = ?, balance = ? WHERE id = ?",
      )
      .run(currency, newBalance, userId);

    const io = app.get("io");
    if (io) {
      io.emit("balance_updated", { userId: parseInt(userId), newBalance });
      io.emit("currency_updated", {
        userId: parseInt(userId),
        preferred_currency: currency,
        newBalance,
      });
    }

    return res.json({ success: true, newBalance });
  }

  res.json({ success: true, balance: user.balance });
}));

// Notifications
app.get("/api/notifications/:userId", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.userId))
    return res.status(400).json({ error: "Invalid user ID" });
  const user = (await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(req.params.userId)) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.role === "admin") {
    const orders = (await db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'")
      .get()) as any;
    const recharges = (await db
      .prepare(
        "SELECT COUNT(*) as count FROM recharge_requests WHERE status = 'pending'",
      )
      .get()) as any;
    res.json({ orders: orders.count, recharges: recharges.count });
  } else {
    const orders = (await db
      .prepare(
        "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status != 'pending' AND user_read = 0",
      )
      .get(user.id)) as any;
    const recharges = (await db
      .prepare(
        "SELECT COUNT(*) as count FROM recharge_requests WHERE user_id = ? AND status != 'pending' AND user_read = 0",
      )
      .get(user.id)) as any;
    res.json({ orders: orders.count, recharges: recharges.count });
  }
}));

app.post("/api/notifications/read", asyncHandler(async (req: any, res: any) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  const user = (await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(user_id)) as any;
  if (user && user.role !== "admin") {
    await db
      .prepare(
        "UPDATE orders SET user_read = 1 WHERE user_id = ? AND status != 'pending'",
      )
      .run(user_id);
    await db
      .prepare(
        "UPDATE recharge_requests SET user_read = 1 WHERE user_id = ? AND status != 'pending'",
      )
      .run(user_id);
  }

  res.json({ success: true });
}));

// Upload endpoint
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
  // Convert buffer to Base64 string
  const base64String = req.file.buffer.toString('base64');
  const mimeType = req.file.mimetype;
  const dataUrl = `data:${mimeType};base64,${base64String}`;
  
  res.json({ url: dataUrl });
});

app.delete("/api/upload", (req, res) => {
  // We don't need to delete anything from the filesystem anymore
  // because we are storing images as Base64 in the database.
  res.json({ success: true });
});

// Messages
app.get("/api/messages/:userId", asyncHandler(async (req: any, res: any) => {
  const userId = req.params.userId;
  if (!isValidId(userId))
    return res.status(400).json({ error: "Invalid user ID" });
  const messages = await db
    .prepare(
      "SELECT * FROM messages WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC",
    )
    .all(userId);
  res.json(messages);
}));

app.post("/api/admin/messages", asyncHandler(async (req: any, res: any) => {
  const { targetType, targetCode, title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
  }

  let userId = null;
  if (targetType === "specific") {
    if (!targetCode)
      return res.status(400).json({ error: "كود المستخدم مطلوب" });
    const user = (await db
      .prepare("SELECT id FROM users WHERE a_code = ?")
      .get(targetCode)) as any;
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
    userId = user.id;
  }

  await db
    .prepare("INSERT INTO messages (user_id, title, content) VALUES (?, ?, ?)")
    .run(userId, title, content);
  res.json({ success: true });
}));

// Admin Balance Management
app.get("/api/admin/users/search", asyncHandler(async (req: any, res: any) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "كود المستخدم مطلوب" });

  const user = await db
    .prepare(
      "SELECT id, name, email, balance, a_code, preferred_currency FROM users WHERE a_code = ?",
    )
    .get(code);
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

  res.json(user);
}));

app.post("/api/admin/balance", asyncHandler(async (req: any, res: any) => {
  const { userId, amount, action, currency } = req.body;
  if (!userId || !amount || (action !== "add" && action !== "subtract")) {
    return res.status(400).json({ error: "بيانات غير صالحة" });
  }

  if (!isValidId(userId))
    return res.status(400).json({ error: "Invalid user ID" });

  const user = (await db
    .prepare("SELECT balance, preferred_currency FROM users WHERE id = ?")
    .get(userId)) as any;
  if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

  const rates = await getRates();
  const amountInUserCurrency = convertCurrency(
    parseFloat(amount),
    currency || "$",
    user.preferred_currency,
    rates,
  );

  let newBalance = user.balance;
  let transactionNumber = "";
  if (action === "add") {
    newBalance += amountInUserCurrency;
    transactionNumber = "إيداع من قبل المسؤول";
  } else {
    newBalance = Math.max(0, newBalance - amountInUserCurrency);
    transactionNumber = "سحب من قبل المسؤول";
  }

  try {
    await db.transaction(async () => {
      await db
        .prepare("UPDATE users SET balance = ? WHERE id = ?")
        .run(newBalance, userId);
      await db
        .prepare(
          `
        INSERT INTO recharge_requests (user_id, transaction_number, amount, currency, status) 
        VALUES (?, ?, ?, ?, 'accepted')
      `,
        )
        .run(
          userId,
          transactionNumber,
          amountInUserCurrency,
          user.preferred_currency,
        );
    })();

    const io = app.get("io");
    if (io)
      io.emit("balance_updated", { userId: parseInt(userId), newBalance });

    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ أثناء تحديث الرصيد" });
  }
}));

try {
  await db
    .prepare(
      "UPDATE users SET preferred_currency = 'SYR' WHERE preferred_currency = 'ل.س'",
    )
    .run();
  await db
    .prepare(
      "UPDATE users SET preferred_currency = 'TRY' WHERE preferred_currency = 'ل.ت'",
    )
    .run();
} catch (e) {}

// Users Management
app.get("/api/admin/users", asyncHandler(async (req: any, res: any) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
  const users = await db
    .prepare(
      `
    SELECT id, name, email, password, plain_password, balance, role, a_code, preferred_currency, created_at, last_login 
    FROM users 
    ORDER BY COALESCE(last_login, created_at) DESC 
    LIMIT $1
  `,
    )
    .all(limit);
  res.json(users);
}));

app.delete("/api/admin/users/:id", asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid user ID" });
  try {
    await db.transaction(async () => {
      // حذف البيانات المرتبطة أولاً
      await db.prepare("DELETE FROM orders WHERE user_id = ?").run(id);
      await db.prepare("DELETE FROM recharge_requests WHERE user_id = ?").run(id);
      await db.prepare("DELETE FROM used_promo_codes WHERE user_id = ?").run(id);
      await db.prepare("DELETE FROM messages WHERE user_id = ?").run(id);
      
      // حذف المستخدم
      await db.prepare("DELETE FROM users WHERE id = ?").run(id);
    })();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "حدث خطأ أثناء حذف المستخدم: " + err.message });
  }
}));

app.put("/api/admin/users/:id", asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid user ID" });
  const { name, email, password, balance, role, a_code, preferred_currency } =
    req.body;

  try {
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db
        .prepare(
          `
        UPDATE users 
        SET name = ?, email = ?, password = ?, plain_password = ?, balance = ?, role = ?, a_code = ?, preferred_currency = ?
        WHERE id = ?
      `,
        )
        .run(
          name,
          email,
          hashedPassword,
          password,
          balance,
          role,
          a_code,
          preferred_currency,
          id,
        );
    } else {
      await db
        .prepare(
          `
        UPDATE users 
        SET name = ?, email = ?, balance = ?, role = ?, a_code = ?, preferred_currency = ?
        WHERE id = ?
      `,
        )
        .run(name, email, balance, role, a_code, preferred_currency, id);
    }
    res.json({ success: true });
  } catch (err: any) {
    if (
      err.message.includes("UNIQUE constraint failed") ||
      err.message.includes("duplicate key value")
    ) {
      return res
        .status(400)
        .json({ error: "البريد الإلكتروني أو كود المستخدم مسجل مسبقاً" });
    }
    res.status(500).json({ error: "حدث خطأ أثناء تحديث المستخدم" });
  }
}));

app.post("/api/admin/users/:id/logout", (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid user ID" });
  const io = req.app.get("io");
  if (io) {
    io.emit("force_logout", { userId: parseInt(id) });
  }
  res.json({ success: true });
});

app.get("/api/admin/stats", asyncHandler(async (req: any, res: any) => {
  const userCount = (await db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get()) as any;
  const orderCount = (await db
    .prepare("SELECT COUNT(*) as count FROM orders")
    .get()) as any;
  const totalBalance = (await db
    .prepare("SELECT SUM(balance) as total FROM users")
    .get()) as any;
  res.json({
    userCount: userCount.count,
    orderCount: orderCount.count,
    totalBalance: totalBalance.total || 0,
  });
}));

// Categories
app.get("/api/categories", asyncHandler(async (req: any, res: any) => {
  const categories = await db.prepare("SELECT * FROM categories ORDER BY id ASC").all();
  res.json(categories);
}));

app.post("/api/categories", asyncHandler(async (req: any, res: any) => {
  try {
    const { name, parent_id, image_url } = req.body;
    console.log("Adding category:", { name, parent_id, image_url });
    const result = await db
      .prepare(
        "INSERT INTO categories (name, parent_id, image_url) VALUES (?, ?, ?)",
      )
      .run(name, parent_id || null, image_url || null);
    console.log("Category added with ID:", result.lastInsertRowid);

    const io = app.get("io");
    if (io) io.emit("categories_updated");

    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    console.error("Error adding category:", err);
    res.status(500).json({ error: err.message });
  }
}));

app.put("/api/categories/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid category ID" });
  try {
    const { name, parent_id, image_url } = req.body;
    await db
      .prepare(
        "UPDATE categories SET name = ?, parent_id = ?, image_url = ? WHERE id = ?",
      )
      .run(name, parent_id || null, image_url || null, req.params.id);

    const io = app.get("io");
    if (io) io.emit("categories_updated");

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

app.delete("/api/categories/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid category ID" });
  await db
    .prepare("UPDATE products SET category_id = NULL WHERE category_id = ?")
    .run(req.params.id);
  await db
    .prepare("UPDATE categories SET parent_id = NULL WHERE parent_id = ?")
    .run(req.params.id);
  await db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);

  const io = app.get("io");
  if (io) io.emit("categories_updated");

  res.json({ success: true });
}));

// Products
app.get("/api/products", asyncHandler(async (req: any, res: any) => {
  const products = await db.prepare("SELECT * FROM products ORDER BY id ASC").all();
  res.json(products);
}));

app.post("/api/products", asyncHandler(async (req: any, res: any) => {
  try {
    const {
      name,
      description,
      image_url,
      price,
      category_id,
      old_price,
      currency,
      profit_try,
    } = req.body;
    console.log("Adding product:", {
      name,
      description,
      image_url,
      price,
      category_id,
      currency,
      profit_try,
    });
    const result = await db
      .prepare(
        "INSERT INTO products (name, description, image_url, price, category_id, old_price, currency, profit_try) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        name,
        description,
        image_url,
        price,
        category_id || null,
        old_price || null,
        currency || "$",
        profit_try || 0,
      );
    console.log("Product added with ID:", result.lastInsertRowid);
    const io = app.get("io");
    if (io) io.emit("products_updated");
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    console.error("Error adding product:", err);
    res.status(500).json({ error: err.message });
  }
}));

app.put("/api/products/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid product ID" });
  const {
    name,
    description,
    image_url,
    price,
    category_id,
    old_price,
    currency,
    profit_try,
  } = req.body;
  await db
    .prepare(
      "UPDATE products SET name = ?, description = ?, image_url = ?, price = ?, category_id = ?, old_price = ?, currency = ?, profit_try = ? WHERE id = ?",
    )
    .run(
      name,
      description,
      image_url,
      price,
      category_id || null,
      old_price || null,
      currency || "$",
      profit_try || 0,
      req.params.id,
    );
  const io = app.get("io");
  if (io) io.emit("products_updated");
  res.json({ success: true });
}));

app.delete("/api/products/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid product ID" });
  try {
    await db.transaction(async () => {
      // حذف الطلبات المرتبطة بهذا المنتج أولاً
      await db.prepare("DELETE FROM orders WHERE product_id = ?").run(req.params.id);
      // حذف المنتج
      await db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    })();
    const io = app.get("io");
    if (io) io.emit("products_updated");
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "حدث خطأ أثناء حذف المنتج: " + err.message });
  }
}));

// Admin Reports (Manual Transactions & Promo Codes)
app.get("/api/admin/manual-transactions", asyncHandler(async (req: any, res: any) => {
  try {
    const transactions = await db
      .prepare(
        `
      SELECT r.id, r.user_id, r.amount, r.currency, r.transaction_number, r.created_at, u.name as user_name, u.a_code as user_code
      FROM recharge_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.transaction_number IN ('إيداع من قبل المسؤول', 'سحب من قبل المسؤول')
      ORDER BY r.created_at DESC
    `,
      )
      .all();
    res.json(transactions);
  } catch (err: any) {
    console.error("Error fetching manual transactions:", err);
    res.status(500).json({ error: err.message });
  }
}));

app.get("/api/admin/promo-codes-with-usage", asyncHandler(async (req: any, res: any) => {
  try {
    const codes = await db
      .prepare(
        `
      SELECT p.*, 
        (SELECT json_agg(json_build_object('id', upc.id, 'user_id', u.id, 'name', u.name, 'a_code', u.a_code, 'used_at', upc.created_at)) 
         FROM used_promo_codes upc 
         JOIN users u ON upc.user_id = u.id 
         WHERE upc.promo_code_id = p.id) as usages
      FROM promo_codes p
      ORDER BY p.created_at DESC
    `,
      )
      .all();

    // Parse the JSON string from PostgreSQL (if it returns string, otherwise it might be already parsed)
    const parsedCodes = codes.map((c: any) => {
      let usages = c.usages || [];
      if (typeof usages === "string") {
        try {
          usages = JSON.parse(usages);
        } catch (e) {}
      }
      if (usages.length === 1 && usages[0].id === null) {
        usages = [];
      }
      
      let excluded_categories = c.excluded_categories || [];
      if (typeof excluded_categories === "string") {
        try {
          excluded_categories = JSON.parse(excluded_categories);
        } catch (e) {}
      }

      return {
        ...c,
        usages,
        excluded_categories,
      };
    });

    res.json(parsedCodes);
  } catch (err: any) {
    console.error("Error fetching promo codes:", err);
    res.status(500).json({ error: err.message });
  }
}));

// Settings
app.get("/api/settings", asyncHandler(async (req: any, res: any) => {
  await getRates(); // Ensure rates are updated/cached
  const settings = await db.prepare("SELECT * FROM settings").all();
  const settingsObj = settings.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  res.json(settingsObj);
}));

app.put("/api/settings", asyncHandler(async (req: any, res: any) => {
  try {
    const settings = req.body;
    const update = await db.prepare(
      "UPDATE settings SET value = $1 WHERE key = $2",
    );
    const insert = await db.prepare(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    );

    for (const [key, value] of Object.entries(settings)) {
      const val = value === undefined ? null : value;
      await insert.run(key, val);
      await update.run(val, key);
    }

    // Clear cached rates to force a refresh with new settings/offsets
    lastFetchTime = 0;

    const io = app.get("io");
    if (io) io.emit("settings_updated");

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
}));

// Telegram Notification Helper
// Simple notification queue to handle rate limiting
let notificationQueue = Promise.resolve();

async function sendTelegramNotification(message: string, keyboard?: any, retries = 3) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("[Telegram Debug] Telegram credentials not set, skipping notification.");
    return;
  }

  // Chain the notification to the queue
  notificationQueue = notificationQueue.then(async () => {
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const body: any = {
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        };
        if (keyboard) {
          body.reply_markup = keyboard;
        }
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[Telegram Debug] API error (attempt ${i + 1}):`, errorData);
          if (errorData.error_code === 429) {
            const retryAfter = (errorData.parameters?.retry_after || 5) * 1000;
            console.log(`[Telegram Debug] Rate limited, retrying after ${retryAfter}ms`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue; // Retry
          }
          throw new Error(`Telegram API error: ${response.statusText}`);
        } else {
          console.log("[Telegram Debug] Notification sent successfully");
          return; // Success
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error(`[Telegram Debug] Request timed out (attempt ${i + 1})`);
        } else {
          console.error(`[Telegram Debug] Failed to send notification (attempt ${i + 1}):`, error);
        }
        if (i === retries - 1) throw error; // Rethrow on last attempt
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }).catch(err => {
    console.error("[Telegram Debug] Notification queue error:", err);
  });
}

// Recharge Requests
app.post("/api/recharge", asyncHandler(async (req: any, res: any) => {
  const { user_id, transaction_number, amount, currency } = req.body;
  if (!isValidId(user_id))
    return res.status(400).json({ error: "Invalid user ID" });
  const result = await db
    .prepare(
      "INSERT INTO recharge_requests (user_id, transaction_number, amount, currency) VALUES (?, ?, ?, ?)",
    )
    .run(user_id, transaction_number, amount, currency);

  const io = app.get("io");
  if (io) {
    io.emit("recharge_requested");
    sendPushToAdmins("طلب شحن جديد", "يوجد طلب شحن رصيد جديد بانتظار المراجعة");
  }

  // Send Notification to Admin
  const user = (await db.prepare("SELECT name, a_code FROM users WHERE id = ?").get(user_id)) as any;
  const userName = user?.name || "غير معروف";
  const userCode = user?.a_code || "غير معروف";
  const message = `<b>طلب شحن جديد</b>\n\nالمستخدم: ${userName}\nالأيدي: <code>${userCode}</code>\nالمبلغ: ${amount} ${currency}\nالرقم: ${transaction_number}`;
  const keyboard = {
    inline_keyboard: [[
      { text: "قبول", callback_data: `recharge_accept:${result.lastInsertRowid}:${user_id}` },
      { text: "رفض", callback_data: `recharge_reject:${result.lastInsertRowid}:${user_id}` }
    ]]
  };
  sendTelegramNotification(message, keyboard);

  res.json({ id: result.lastInsertRowid });
}));

app.get("/api/recharge", asyncHandler(async (req: any, res: any) => {
  const { user_id } = req.query;
  let requests;
  if (user_id) {
    if (!isValidId(user_id))
      return res.status(400).json({ error: "Invalid user ID" });
    requests = await db
      .prepare(
        "SELECT * FROM recharge_requests WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(user_id);
  } else {
    requests = await db
      .prepare(
        `
      SELECT r.*, u.name as user_name, u.a_code as user_a_code, u.preferred_currency as user_currency
      FROM recharge_requests r 
      JOIN users u ON r.user_id = u.id 
      ORDER BY r.created_at DESC
    `,
      )
      .all();
  }
  res.json(requests);
}));

app.put("/api/recharge/:id", asyncHandler(async (req: any, res: any) => {
  console.log(`[Recharge Action] ID: ${req.params.id}, Body:`, req.body);
  const { status } = req.body; // 'accepted' or 'rejected'
  if (!status) {
    return res.status(400).json({ error: "Missing status", receivedBody: req.body });
  }
  const id = req.params.id;
  if (!isValidId(id))
    return res.status(400).json({ error: "Invalid request ID" });

  const request = (await db
    .prepare("SELECT * FROM recharge_requests WHERE id = ?")
    .get(id)) as any;
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "pending")
    return res.status(400).json({ error: "Request already processed" });

  console.log(`[Recharge Action] Processing request for user ${request.user_id}, amount ${request.amount} ${request.currency}`);

  await db.transaction(async () => {
    const updateResult = await db
      .prepare("UPDATE recharge_requests SET status = ? WHERE id = ?")
      .run(status, id);
    console.log(`[Recharge Action] Update status result:`, updateResult);

    if (status === "accepted") {
      const user = (await db
        .prepare("SELECT preferred_currency FROM users WHERE id = ?")
        .get(request.user_id)) as any;
      const rates = await getRates();
      const amountInUserCurrency = convertCurrency(
        request.amount,
        request.currency,
        user.preferred_currency,
        rates,
      );

      console.log(`[Recharge Action] Converting ${request.amount} ${request.currency} to ${user.preferred_currency}: ${amountInUserCurrency}`);

      const balanceUpdate = await db
        .prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
        .run(amountInUserCurrency, request.user_id);
      console.log(`[Recharge Action] Balance update result:`, balanceUpdate);

      const io = app.get("io");
      if (io) {
        const updatedUser = (await db
          .prepare("SELECT balance FROM users WHERE id = ?")
          .get(request.user_id)) as any;
        io.emit("balance_updated", {
          userId: request.user_id,
          newBalance: updatedUser.balance,
        });
      }
    }
  })();

  const io = app.get("io");
  if (io) {
    io.emit("recharge_updated", { userId: request.user_id });
    sendPushNotification(request.user_id, "تحديث حالة الشحن", `تم تحديث حالة طلب الشحن الخاص بك إلى: ${status === 'accepted' ? 'مقبول' : 'مرفوض'}`);
  }

  res.json({ success: true });
}));

app.get("/api/test-rates", asyncHandler(async (req: any, res: any) => {
  const rates = await getRates();
  res.json(rates);
}));

// Promo Codes
app.get("/api/promo-codes", asyncHandler(async (req: any, res: any) => {
  const codes = await db
    .prepare("SELECT * FROM promo_codes ORDER BY created_at DESC")
    .all();
  res.json(codes);
}));

app.post("/api/promo-codes", asyncHandler(async (req: any, res: any) => {
  const { code, type, value, currency, usage_limit, excluded_categories } = req.body;
  try {
    const result = await db
      .prepare(
        "INSERT INTO promo_codes (code, type, value, currency, usage_limit, excluded_categories) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(code, type, value, currency || "$", usage_limit || 0, JSON.stringify(excluded_categories || []));

    const io = app.get("io");
    if (io) io.emit("promo_codes_updated");

    res.json({ id: result.lastInsertRowid });
  } catch (e: any) {
    if (
      e.message.includes("UNIQUE") ||
      e.message.includes("duplicate key value")
    ) {
      return res.status(400).json({ error: "هذا الكود موجود مسبقاً" });
    }
    res.status(500).json({ error: "حدث خطأ أثناء إضافة الكود" });
  }
}));

app.put("/api/promo-codes/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid promo code ID" });
  const { code, type, value, currency, usage_limit, excluded_categories } = req.body;
  try {
    await db
      .prepare(
        "UPDATE promo_codes SET code = ?, type = ?, value = ?, currency = ?, usage_limit = ?, excluded_categories = ? WHERE id = ?",
      )
      .run(code, type, value, currency || "$", usage_limit || 0, JSON.stringify(excluded_categories || []), req.params.id);
    const io = req.app.get("io");
    if (io) io.emit("promo_codes_updated");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

app.delete("/api/admin/promo-codes/usage/:id", asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  if (!isValidId(id))
    return res.status(400).json({ error: "Invalid usage ID" });
  try {
    await db.prepare("DELETE FROM used_promo_codes WHERE id = ?").run(id);
    const io = app.get("io");
    if (io) io.emit("promo_codes_updated");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "حدث خطأ أثناء حذف سجل الاستخدام" });
  }
}));

app.delete("/api/promo-codes/:id", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid promo code ID" });
  try {
    await db.transaction(async () => {
      await db
        .prepare("DELETE FROM used_promo_codes WHERE promo_code_id = ?")
        .run(req.params.id);
      await db
        .prepare("DELETE FROM promo_codes WHERE id = ?")
        .run(req.params.id);
    })();

    const io = app.get("io");
    if (io) io.emit("promo_codes_updated");

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "حدث خطأ أثناء الحذف" });
  }
}));

app.post("/api/promo-codes/redeem", asyncHandler(async (req: any, res: any) => {
  const { code, user_id } = req.body;
  if (!isValidId(user_id))
    return res.status(400).json({ error: "Invalid user ID" });

  const promo = (await db
    .prepare("SELECT * FROM promo_codes WHERE code = ? AND is_active = 1")
    .get(code)) as any;
  if (!promo)
    return res.status(404).json({ error: "كود غير صالح أو منتهي الصلاحية" });

  // Check usage limit
  if (promo.usage_limit > 0) {
    const usageCount = (await db
      .prepare("SELECT COUNT(*) as count FROM used_promo_codes WHERE promo_code_id = ?")
      .get(promo.id)) as any;
    if (usageCount.count >= promo.usage_limit) {
      return res.status(400).json({ error: "تم الوصول للحد الأقصى لاستخدام هذا الكود" });
    }
  }

  const used = await db
    .prepare(
      "SELECT * FROM used_promo_codes WHERE user_id = ? AND promo_code_id = ?",
    )
    .get(user_id, promo.id);
  if (used)
    return res.status(400).json({ error: "لقد قمت باستخدام هذا الكود مسبقاً" });

  if (promo.type === "balance") {
    await db.transaction(async () => {
      const user = (await db
        .prepare("SELECT preferred_currency FROM users WHERE id = ?")
        .get(user_id)) as any;
      const rates = await getRates();
      const amountInUserCurrency = convertCurrency(
        promo.value,
        promo.currency || "$",
        user.preferred_currency,
        rates,
      );

      await db
        .prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
        .run(amountInUserCurrency, user_id);
      await db
        .prepare(
          "INSERT INTO used_promo_codes (user_id, promo_code_id) VALUES (?, ?)",
        )
        .run(user_id, promo.id);

      const io = app.get("io");
      if (io) {
        const updatedUser = (await db
          .prepare("SELECT balance FROM users WHERE id = ?")
          .get(user_id)) as any;
        io.emit("balance_updated", {
          userId: parseInt(user_id),
          newBalance: updatedUser.balance,
        });
        io.emit("promo_codes_updated");
      }
      
      // We need to return the amount in user's currency to display it correctly
      res.json({ success: true, type: "balance", amount: amountInUserCurrency });
    })();
  } else if (promo.type === "discount") {
    // For discount codes, we just record that the user has "activated" it.
    // We might want to ensure they only have one active discount code of this type?
    // For now, let's just allow activating it.
    await db
      .prepare(
        "INSERT INTO used_promo_codes (user_id, promo_code_id) VALUES (?, ?)",
      )
      .run(user_id, promo.id);
      
    const user = (await db
      .prepare("SELECT preferred_currency FROM users WHERE id = ?")
      .get(user_id)) as any;
    const rates = await getRates();
    const amountInUserCurrency = convertCurrency(
      promo.value,
      promo.currency || "$",
      user.preferred_currency,
      rates,
    );
      
    const io = app.get("io");
    if (io) io.emit("promo_codes_updated");
      
    res.json({ success: true, type: "discount", value: amountInUserCurrency });
  } else {
    res.status(400).json({ error: "نوع كود غير معروف" });
  }
}));

app.get("/api/promo-codes/check", asyncHandler(async (req: any, res: any) => {
  const { code, type, user_id } = req.query;

  if (!code || !type || !user_id) {
    return res.status(400).json({ error: "بيانات غير مكتملة" });
  }

  if (!isValidId(user_id))
    return res.status(400).json({ error: "Invalid user ID" });

  const promo = (await db
    .prepare("SELECT * FROM promo_codes WHERE code = ? AND is_active = 1")
    .get(code)) as any;
  if (!promo)
    return res.status(404).json({ error: "كود غير صالح أو منتهي الصلاحية" });

  if (promo.type !== type) {
    return res.status(400).json({ error: "نوع الكود غير مطابق" });
  }

  const used = await db
    .prepare(
      "SELECT * FROM used_promo_codes WHERE user_id = ? AND promo_code_id = ?",
    )
    .get(user_id, promo.id);
  if (used)
    return res.status(400).json({ error: "لقد قمت باستخدام هذا الكود مسبقاً" });

  res.json({ success: true, value: promo.value || 0, currency: promo.currency || "$" });
}));

// Get user's active discount
app.get("/api/users/:id/discount", asyncHandler(async (req: any, res: any) => {
  if (!isValidId(req.params.id))
    return res.status(400).json({ error: "Invalid user ID" });
  const discount = (await db
    .prepare(
      `
    SELECT pc.value, pc.code, pc.currency, pc.excluded_categories
    FROM used_promo_codes upc
    JOIN promo_codes pc ON upc.promo_code_id = pc.id
    WHERE upc.user_id = ? AND pc.type = 'discount' AND pc.is_active = 1
    ORDER BY upc.created_at DESC
    LIMIT 1
  `,
    )
    .get(req.params.id)) as any;

  if (discount && discount.excluded_categories) {
    try {
      discount.excluded_categories = JSON.parse(discount.excluded_categories);
    } catch (e) {
      discount.excluded_categories = [];
    }
  }

  res.json({ success: true, discount: discount || null });
}));

// Orders
app.post("/api/orders", asyncHandler(async (req: any, res: any) => {
  const { user_id, product_id, phone_or_id } = req.body;
  if (!isValidId(user_id))
    return res.status(400).json({ error: "Invalid user ID" });
  if (!isValidId(product_id))
    return res.status(400).json({ error: "Invalid product ID" });

  const user = (await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(user_id)) as any;
  const product = (await db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(product_id)) as any;

  if (!user || !product)
    return res.status(404).json({ error: "User or Product not found" });

  const rates = await getRates();
  const basePrice = product.currency === 'TRY' || product.currency === 'ل.ت'
    ? product.price + (product.profit_try || 0)
    : product.price + (product.profit_try || 0) / rates.try;
  let productPriceInUserCurrency = convertCurrency(
    basePrice,
    product.currency || "$",
    user.preferred_currency,
    rates,
  );

  // Check if user has an activated discount code
  const activeDiscount = (await db
    .prepare(
      `
    SELECT pc.value, pc.currency as pc_currency, pc.excluded_categories
    FROM used_promo_codes upc
    JOIN promo_codes pc ON upc.promo_code_id = pc.id
    WHERE upc.user_id = ? AND pc.type = 'discount' AND pc.is_active = 1
    ORDER BY upc.created_at DESC
    LIMIT 1
  `,
    )
    .get(user_id)) as any;

  if (activeDiscount) {
    let excludedCategories: number[] = [];
    try {
      excludedCategories = JSON.parse(activeDiscount.excluded_categories || '[]').map(Number);
    } catch (e) {
      excludedCategories = [];
    }

    let isExcluded = false;
    if (product.category_id) {
      const productCategory = (await db.prepare("SELECT id, parent_id FROM categories WHERE id = ?").get(product.category_id)) as any;
      if (productCategory) {
        if (excludedCategories.includes(Number(productCategory.id))) {
          isExcluded = true;
        } else if (productCategory.parent_id && excludedCategories.includes(Number(productCategory.parent_id))) {
          isExcluded = true;
        }
      }
    }

    if (!isExcluded) {
      const discountInUserCurrency = convertCurrency(
        activeDiscount.value,
        activeDiscount.pc_currency || "$",
        user.preferred_currency,
        rates,
      );
      productPriceInUserCurrency = Math.max(
        0,
        productPriceInUserCurrency - discountInUserCurrency,
      );
    }
  }

  if (user.balance < productPriceInUserCurrency) {
    return res.status(400).json({ error: "ليس لديك رصيد كافٍ" });
  }

  let orderId: any;
  await db.transaction(async () => {
    // Deduct balance
    await db
      .prepare("UPDATE users SET balance = balance - ? WHERE id = ?")
      .run(productPriceInUserCurrency, user_id);
    // Create order
    const result = await db
      .prepare(
        "INSERT INTO orders (user_id, product_id, phone_or_id, paid_price) VALUES (?, ?, ?, ?)",
      )
      .run(user_id, product_id, phone_or_id, productPriceInUserCurrency);
    orderId = result.lastInsertRowid;
  })();

  const io = app.get("io");
  if (io) {
    const updatedUser = (await db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(user_id)) as any;
    io.emit("balance_updated", {
      userId: user_id,
      newBalance: updatedUser.balance,
    });
    io.emit("order_created");
    sendPushToAdmins("طلب منتج جديد", "يوجد طلب شراء جديد بانتظار المراجعة");
  }

  // Send Notification to Admin
  const productInfo = (await db.prepare("SELECT name FROM products WHERE id = ?").get(product_id)) as any;
  const userInfo = (await db.prepare("SELECT name, a_code FROM users WHERE id = ?").get(user_id)) as any;
  const userName = userInfo?.name || "غير معروف";
  const userCode = userInfo?.a_code || "غير معروف";
  const productName = productInfo?.name || "منتج غير معروف";
  
  const message = `<b>طلب شراء جديد</b>\n\nالمستخدم: ${userName}\nالأيدي: <code>${userCode}</code>\nالمنتج: ${productName}\nالسعر: ${productPriceInUserCurrency} ${user.preferred_currency}`;
  const keyboard = {
    inline_keyboard: [[
      { text: "قبول", callback_data: `order_accept:${orderId}:${user_id}` },
      { text: "رفض", callback_data: `order_reject:${orderId}:${user_id}` }
    ]]
  };
  sendTelegramNotification(message, keyboard);

  res.json({ success: true });
}));

app.get("/api/orders", asyncHandler(async (req: any, res: any) => {
  const { user_id } = req.query;
  let orders;
  if (user_id) {
    if (!isValidId(user_id))
      return res.status(400).json({ error: "Invalid user ID" });
    orders = await db
      .prepare(
        `
      SELECT o.*, p.name as product_name, p.image_url as product_image, p.price as product_price,
             c.name as category_name, pc.name as parent_category_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `,
      )
      .all(user_id);
  } else {
    orders = await db
      .prepare(
        `
      SELECT o.*, u.name as user_name, u.a_code as user_a_code, p.name as product_name, p.image_url as product_image, p.price as product_price,
             c.name as category_name, pc.name as parent_category_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      ORDER BY o.created_at DESC
    `,
      )
      .all();
  }
  res.json(orders);
}));

app.put("/api/orders/:id", asyncHandler(async (req: any, res: any) => {
  console.log(`[Order Action] ID: ${req.params.id}, Body:`, req.body);
  const { status } = req.body; // 'accepted' or 'rejected'
  if (!status) {
    return res.status(400).json({ error: "Missing status", receivedBody: req.body });
  }
  const id = req.params.id;
  if (!isValidId(id))
    return res.status(400).json({ error: "Invalid order ID" });

  const order = (await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(id)) as any;
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "pending")
    return res.status(400).json({ error: "Order already processed" });

  console.log(`[Order Action] Processing order for user ${order.user_id}, status: ${status}`);

  await db.transaction(async () => {
    const updateResult = await db
      .prepare("UPDATE orders SET status = ? WHERE id = ?")
      .run(status, id);
    console.log(`[Order Action] Update status result:`, updateResult);

    if (status === "rejected") {
      // Refund user the actual paid price
      console.log(`[Order Action] Refunding user ${order.user_id} amount ${order.paid_price}`);
      const refundResult = await db
        .prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
        .run(order.paid_price || 0, order.user_id);
      console.log(`[Order Action] Refund result:`, refundResult);
    }
  })();

  const io = app.get("io");
  if (io) {
    io.emit("order_updated", { userId: order.user_id });
    sendPushNotification(order.user_id, "تحديث حالة الطلب", `تم تحديث حالة طلبك إلى: ${status === 'accepted' ? 'مقبول' : 'مرفوض'}`);
    if (status === "rejected") {
      const updatedUser = (await db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(order.user_id)) as any;
      io.emit("balance_updated", {
        userId: order.user_id,
        newBalance: updatedUser.balance,
      });
    }
  }

  res.json({ success: true });
}));

async function startServer() {
  let dbInitialized = false;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT,
          email TEXT UNIQUE,
          password TEXT,
          balance REAL DEFAULT 0,
          role TEXT DEFAULT 'user',
          reset_code TEXT,
          reset_expires TIMESTAMP,
          a_code TEXT UNIQUE,
          preferred_currency TEXT DEFAULT '$',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT,
          parent_id INTEGER,
          image_url TEXT,
          FOREIGN KEY(parent_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name TEXT,
          description TEXT,
          image_url TEXT,
          price REAL,
          category_id INTEGER,
          currency TEXT DEFAULT '$',
          old_price REAL,
          FOREIGN KEY(category_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS recharge_requests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          transaction_number TEXT,
          amount REAL,
          currency TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          product_id INTEGER,
          phone_or_id TEXT,
          paid_price REAL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id),
          FOREIGN KEY(product_id) REFERENCES products(id)
      );
      CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
      );
      CREATE TABLE IF NOT EXISTS promo_codes (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE,
          type TEXT,
          value REAL,
          currency TEXT DEFAULT '$',
          usage_limit INTEGER DEFAULT 0,
          excluded_categories TEXT DEFAULT '[]',
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS used_promo_codes (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          promo_code_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id),
          FOREIGN KEY(promo_code_id) REFERENCES promo_codes(id)
      );
    `);
    await db.prepare("INSERT INTO settings (key, value) VALUES ('try_rate', '32') ON CONFLICT (key) DO NOTHING").run();
    await db.prepare("INSERT INTO settings (key, value) VALUES ('syp_rate', '14850') ON CONFLICT (key) DO NOTHING").run();
    await db.prepare("INSERT INTO settings (key, value) VALUES ('syp_rate_mode', 'auto') ON CONFLICT (key) DO NOTHING").run();
    await db.prepare("INSERT INTO settings (key, value) VALUES ('try_rate_mode', 'auto') ON CONFLICT (key) DO NOTHING").run();
    await db.prepare("INSERT INTO settings (key, value) VALUES ('syp_offset', '0') ON CONFLICT (key) DO NOTHING").run();
    await db.prepare("INSERT INTO settings (key, value) VALUES ('try_offset', '0') ON CONFLICT (key) DO NOTHING").run();

    dbInitialized = true;
    console.log("Database initialized successfully");

    // Test connection
    try {
      await db.prepare("SELECT 1").get();
      console.log("Database connection test successful");
    } catch (e) {
      console.error("Database connection test failed:", e);
      throw e;
    }

    // Migrations
    try {
      await db.exec("ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_try DECIMAL(10, 2) DEFAULT 0");
    } catch (e) {
      console.error("Error adding profit_try column:", e);
    }
  } catch (error) {
    console.error(
      "Database connection failed. Please check your DATABASE_URL:",
      error,
    );
  }

  // Migrations for users table
  try {
    const usersInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'users'",
      )
      .all()) as any[];

    const hasCreatedAt = usersInfo.some((col) => col.name === "created_at");
    if (!hasCreatedAt) {
      await db.exec("ALTER TABLE users ADD COLUMN created_at TIMESTAMP;");
      await db.exec(
        "UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;",
      );
    }

    const hasLastLogin = usersInfo.some((col) => col.name === "last_login");
    if (!hasLastLogin) {
      await db.exec("ALTER TABLE users ADD COLUMN last_login TIMESTAMP;");
    }

    const hasLoginCode = usersInfo.some((col) => col.name === "login_code");
    if (!hasLoginCode) {
      await db.exec("ALTER TABLE users ADD COLUMN login_code TEXT;");
      await db.exec(
        "ALTER TABLE users ADD COLUMN login_code_expires TIMESTAMP;",
      );
      await db.exec(
        "ALTER TABLE users ADD COLUMN is_modified INTEGER DEFAULT 0;",
      );
    }
  } catch (e) {
    console.error("Failed to run users migrations:", e);
  }

  try {
    const tableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'categories'",
      )
      .all()) as any[];
    const hasImageUrl = tableInfo.some((col) => col.name === "image_url");
    if (!hasImageUrl) {
      await db.exec("ALTER TABLE categories ADD COLUMN image_url TEXT;");
    }
  } catch (e) {}

  try {
    const tableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'orders'",
      )
      .all()) as any[];
    if (!tableInfo.some((col) => col.name === "paid_price")) {
      await db.exec("ALTER TABLE orders ADD COLUMN paid_price REAL;");
    }
  } catch (e) {}

  try {
    const tableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'products'",
      )
      .all()) as any[];
    if (!tableInfo.some((col) => col.name === "old_price")) {
      await db.exec("ALTER TABLE products ADD COLUMN old_price REAL;");
    }
  } catch (e) {}

  try {
    await db.exec(
      "ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);",
    );
  } catch (e) {
    // Column might already exist
  }

  try {
    const tableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'users'",
      )
      .all()) as any[];
    if (!tableInfo.some((col) => col.name === "preferred_currency")) {
      await db.exec(
        "ALTER TABLE users ADD COLUMN preferred_currency TEXT DEFAULT '$';",
      );
    }
    if (!tableInfo.some((col) => col.name === "a_code")) {
      await db.exec("ALTER TABLE users ADD COLUMN a_code TEXT;");
      await db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_a_code ON users(a_code);",
      );
    }
    if (!tableInfo.some((col) => col.name === "plain_password")) {
      await db.exec("ALTER TABLE users ADD COLUMN plain_password TEXT;");
    }
  } catch (e) {
    console.log("Error adding user columns:", e);
  }

  try {
    const promoTableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'promo_codes'",
      )
      .all()) as any[];
    if (!promoTableInfo.some((col) => col.name === "usage_limit")) {
      await db.exec("ALTER TABLE promo_codes ADD COLUMN usage_limit INTEGER DEFAULT 0;");
    }
    if (!promoTableInfo.some((col) => col.name === "excluded_categories")) {
      await db.exec("ALTER TABLE promo_codes ADD COLUMN excluded_categories TEXT DEFAULT '[]';");
    }
    if (!promoTableInfo.some((col) => col.name === "currency")) {
      await db.exec("ALTER TABLE promo_codes ADD COLUMN currency TEXT DEFAULT '$';");
    }
  } catch (e) {
    console.log("Error adding promo_codes columns:", e);
  }

  try {
    const tableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'orders'",
      )
      .all()) as any[];
    if (!tableInfo.some((col) => col.name === "user_read")) {
      await db.exec(
        "ALTER TABLE orders ADD COLUMN user_read INTEGER DEFAULT 0;",
      );
    }
  } catch (e) {
    console.log("Error adding user_read to orders:", e);
  }

  try {
    const tableInfo = (await db
      .prepare(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'recharge_requests'",
      )
      .all()) as any[];
    if (!tableInfo.some((col) => col.name === "user_read")) {
      await db.exec(
        "ALTER TABLE recharge_requests ADD COLUMN user_read INTEGER DEFAULT 0;",
      );
    }
    if (!tableInfo.some((col) => col.name === "transaction_number")) {
      await db.exec(
        "ALTER TABLE recharge_requests ADD COLUMN transaction_number TEXT;",
      );
    }
  } catch (e) {
    console.log("Error adding columns to recharge_requests:", e);
  }

  try {
    // Generate a_code for existing users
    const usersWithoutCode = (await db
      .prepare("SELECT id FROM users WHERE a_code IS NULL")
      .all()) as any[];
    for (const user of usersWithoutCode) {
      let code;
      let isUnique = false;
      while (!isUnique) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existing = await db
          .prepare("SELECT id FROM users WHERE a_code = ?")
          .get(code);
        if (!existing) isUnique = true;
      }
      await db
        .prepare("UPDATE users SET a_code = ? WHERE id = ?")
        .run(code, user.id);
    }
  } catch (e) {
    console.log("Error backfilling a_code:", e);
  }

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          title TEXT,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
  } catch (e) {}

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        subscription TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, subscription)
      );
    `);
  } catch (e) {
    console.error("Error creating push_subscriptions table:", e);
  }

  // Default settings
  try {
    const insertSetting = db.prepare(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    );
    await insertSetting.run(
      "recharge_text",
      "يرجى تحويل المبلغ إلى الحساب التالي ثم إدخال رقم العملية هنا.",
    );
    await insertSetting.run(
      "recharge_image",
      "https://picsum.photos/seed/recharge/800/400",
    );
    await insertSetting.run(
      "instructions_text",
      "أهلاً بك في قسم التعليمات. يمكنك هنا إضافة نصوص، روابط، أو حتى تضمين فيديوهات يوتيوب.",
    );
    await insertSetting.run(
      "contact_us_text",
      "يمكنك التواصل معنا عبر الروابط التالية:",
    );
    await insertSetting.run("contact_us_button_text", "اضغط لتتواصل معنا");
    await insertSetting.run("contact_us_button_link", "");
    await insertSetting.run("exchange_rate", "1");
    await insertSetting.run("syp_rate", "15000");
    await insertSetting.run("try_rate", "32");
  } catch (e) {
    console.error("Error inserting default settings:", e);
  }

  // Default admin
  try {
    const adminExists = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get("admin@admin.com");
    if (!adminExists) {
      const defaultPassword = bcrypt.hashSync("admin123", 10);
      await db
        .prepare(
          "INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
        )
        .run("Admin", "admin@admin.com", defaultPassword, "admin");
    }
  } catch (e) {
    console.error("Error creating default admin:", e);
  }

  const isProd = process.env.NODE_ENV === "production";

  const server = http.createServer(app);
  const io = new Server(server);
  app.set("io", io);

  const onlineUsers = new Map<string, string>(); // socketId -> userId

  io.on("connection", (socket) => {
    socket.on("user_connected", (userId) => {
      onlineUsers.set(socket.id, userId.toString());
      io.emit("user_status_changed", {
        userId: parseInt(userId),
        status: "online",
      });
    });

    socket.on("disconnect", () => {
      const userId = onlineUsers.get(socket.id);
      if (userId) {
        onlineUsers.delete(socket.id);
        const isStillOnline = Array.from(onlineUsers.values()).includes(userId);
        if (!isStillOnline) {
          io.emit("user_status_changed", {
            userId: parseInt(userId),
            status: "offline",
          });
        }
      }
    });
  });

  app.get("/api/admin/online-users", (req, res) => {
    const uniqueUsers = Array.from(new Set(onlineUsers.values())).map((id) =>
      parseInt(id),
    );
    res.json(uniqueUsers);
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[Error] ${req.method} ${req.url}:`, err.stack || err);
    
    if (req.path.startsWith("/api/")) {
      return res.status(status).json({ 
        error: message,
        path: req.path,
        timestamp: new Date().toISOString()
      });
    }
    res.status(status).send(message);
  });

  // Telegram Webhook
  app.all("/api/telegram-webhook", asyncHandler(async (req: any, res: any) => {
    console.log("[Telegram Debug] Webhook reached!");
    const update = req.body;
    if (update && update.callback_query) {
      console.log("[Telegram Debug] Callback query received:", update.callback_query);
      const { id, data, message } = update.callback_query;
      const [action, rechargeId, userId] = data.split(":");
      
      const status = action === "recharge_accept" ? "accepted" : "rejected";
      
      const request = (await db
        .prepare("SELECT * FROM recharge_requests WHERE id = ?")
        .get(rechargeId)) as any;
        
      console.log("[Telegram Debug] Request found:", !!request, "Status:", request?.status);
      if (request && request.status === "pending") {
        await db.transaction(async () => {
          await db
            .prepare("UPDATE recharge_requests SET status = ? WHERE id = ?")
            .run(status, rechargeId);
          if (status === "accepted") {
            const user = (await db
              .prepare("SELECT preferred_currency FROM users WHERE id = ?")
              .get(userId)) as any;
            const rates = await getRates();
            const amountInUserCurrency = convertCurrency(
              request.amount,
              request.currency,
              user.preferred_currency,
              rates,
            );

            await db
              .prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
              .run(amountInUserCurrency, userId);
            
            // Notify user
            sendTelegramNotification(`تم قبول طلب شحنك بمبلغ ${request.amount} ${request.currency}.`);
          } else {
            // Notify user
            sendTelegramNotification(`الرجاء التحقق من طلب شحنك بمبلغ ${request.amount} ${request.currency}.`);
          }
        });
        
        // Update Telegram message
        const newText = message.text + `\n\n<b>تم ${status === "accepted" ? "القبول" : "الرفض"}</b>`;
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: newText,
            parse_mode: "HTML"
          })
        });
      }
      
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: id })
      });
    }
    res.sendStatus(200);
  }));

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Global Error Handler] Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });

  // Catch-all for API routes to prevent Vite from serving index.html
  app.all("/api/*", (req, res) => {
    console.log(`API 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: "API route not found",
      method: req.method,
      path: req.originalUrl
    });
  });

  if (!isProd) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to initialize Vite middleware:", e);
    }
  } else {
    // 1. تحديد المسار الصحيح للمجلد
    const distPath = path.resolve(__dirname, "dist");
    
    // 2. خدمة ملفات الواجهة الأمامية
    app.use(express.static(distPath));

    // 3. توجيه جميع الطلبات (عدا الـ API) لملف index.html
    app.get("*", (req, res, next) => {
      // إذا كان الطلب يبدأ بـ /api، لا تلمسه (ليعمل الـ API)
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      // إرسال صفحة الموقع
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  const PORT = process.env.PORT || 3000;
  server.listen(PORT as number, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    
    // Register Telegram Webhook
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const appUrl = process.env.APP_URL;
      if (appUrl) {
        const webhookUrl = `${appUrl}/api/telegram-webhook`;
        const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
        
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl })
        })
        .then(res => res.json())
        .then(data => console.log("Webhook registration:", data))
        .catch(err => console.error("Failed to register webhook:", err));
      }
    }
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
  process.exit(1);
});
