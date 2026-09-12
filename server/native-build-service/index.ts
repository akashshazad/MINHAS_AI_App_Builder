
import "dotenv/config";
import { startNativeBuildService } from "./service";
startNativeBuildService().catch((error) => { console.error(error); process.exitCode = 1; });


