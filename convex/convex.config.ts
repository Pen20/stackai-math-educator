import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(rag);
app.use(agent);

export default app;
