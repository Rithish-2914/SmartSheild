import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roadSafetyRouter from "./road-safety";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roadSafetyRouter);
router.use(aiRouter);

export default router;
