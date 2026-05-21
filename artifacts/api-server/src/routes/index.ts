import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roadSafetyRouter from "./road-safety";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roadSafetyRouter);

export default router;
