import "dotenv/config";
import { whalePulseJob } from "./jobs/whalePulseJob.js";

await whalePulseJob();
