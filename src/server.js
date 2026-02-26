import express from "express";
import cors from "cors";
import "dotenv/config";

import apiRoutes from "./routes/Api.js";

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// ROUTES
app.use("/api", apiRoutes);

// ROOT
app.get("/", (req, res) => {
    res.send("MeanPay API Running 🚀");
});

// PORT
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});