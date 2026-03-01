import dashboardService from "../services/DashboardService.js";

class DashboardController {
    async index(req, res) {
        try {
            const { month, year } = req.query;
            const stats = await dashboardService.getStats(month, year);
            return res.json({
                success: true,
                message: "Dashboard summary data retrieved successfully",
                data: stats
            });
        } catch (error) {
            console.error("Dashboard error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal Server Error",
                error: error.message
            });
        }
    }
}

export default new DashboardController();
