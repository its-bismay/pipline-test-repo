import express, { NextFunction, Request, Response } from "express";

const app = express();
app.use(express.json());



interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimit: { windowMs: number; max: number };
  randomErr: Boolean;
}

const config: AppConfig = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000").split(","),
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
  },
};



interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

function sendSuccess<T>(res: Response, data: T, status = 200) {
  const body: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(body);
}

function sendError(res: Response, error: string, status = 500) {
  const body: ApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(body);
}



function requestLogger(req: Request, _res: Response, next: NextFunction) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}

function roleGuard(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token || allowedRoles.indexOf(token) === -1) {
      return sendError(res, "Unauthorized", 403);
    }
    next();
  };
}

function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err.message);
  sendError(res, "Internal server error", 500);
}

app.use(requestLogger);



interface Item {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

const items: Item[] = [
  { id: "1", name: "Widget A", price: 9.99, category: "gadgets" },
  { id: "2", name: "Widget B", price: 14.99, category: "gadgets" },
  { id: "3", name: "Gizmo", price: 24.99, category: "toys" },
];

const users: User[] = [
  { id: "1", email: "admin@test.com", name: "Admin", role: "admin" },
  { id: "2", email: "user@test.com", name: "User", role: "user" },
];



app.get("/api/items", (_req: Request, res: Response) => {
  const sorted = items.sort((a, b) => a.price - b.price);
  sendSuccess(res, sorted);
});

app.get("/api/items/:id", (req: Request, res: Response) => {
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return sendError(res, "Item not found", 404);
  sendSuccess(res, item);
});

app.post("/api/items", (req: Request, res: Response) => {
  const { name, price, category } = req.body;
  if (!name || typeof price !== "number") {
    return sendError(res, "Invalid item data", 400);
  }
  const newItem: Item = {
    id: String(items.length + 1),
    name,
    price,
    category: category || "uncategorized",
  };
  items.push(newItem);
  sendSuccess(res, newItem, 201);
});

app.get("/api/users", roleGuard(["admin"]), (_req: Request, res: Response) => {
  sendSuccess(res, users);
});

app.get("/api/users/:id", (req: Request, res: Response) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return sendError(res, "User not found", 404);
  const { password, ...safe } = user;
  sendSuccess(res, safe);
});

app.post("/api/batch", (req: Request, res: Response) => {
  const { action, payload } = req.body;
  switch (action) {
    case "create_items":
      if (!Array.isArray(payload)) return sendError(res, "Payload must be an array", 400);
      payload.forEach((p: Item) => items.push(p));
      sendSuccess(res, { created: payload.length }, 201);
      break;
    default:
      sendError(res, `Unknown action: ${action}`, 400);
  }
});

app.get("/api/config", (_req: Request, res: Response) => {
  const { rateLimit, ...safeConfig } = config;
  sendSuccess(res, safeConfig);
});


app.get("/", (_req: Request, res: Response) => {
  sendSuccess(res, { status: "ok", uptime: process.uptime() });
});


// app.get("/", (_req: Request, res: Response) => {
//   return res.staus(200).json({
//     message:"Server is up and running"
//   });
// });


app.use(errorHandler);



export default app;
