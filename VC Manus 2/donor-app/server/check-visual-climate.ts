import { dashboardFor } from "/home/ubuntu/visual-climate/server/routers";
const result = dashboardFor("KHM", 2015, 2023);
console.log(JSON.stringify({ length: result.trend.length, years: result.trend.map((point) => point.year), values: result.trend.map((point) => point.trace) }));
