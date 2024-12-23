import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { resetRegistry } from '../controllers/resetController';

const router = express.Router();

// router.delete('/', authenticateToken as any, resetRegistry);

router.delete('/', resetRegistry);

export default router;