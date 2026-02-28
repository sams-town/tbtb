// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import apiRoutes from "./routes/Api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve folder public/uploads agar bisa diakses public via url /uploads/...
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));
app.use("/lemburs", express.static(path.join(__dirname, "../public/lemburs")));

app.use("/api", apiRoutes);

app.get("/", (req, res) => res.send("MeanPay API Running 🚀"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));