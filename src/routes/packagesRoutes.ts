import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getPackages } from '../controllers/packageController';

const router = express.Router();

router.post('/', authenticateToken as any, getPackages as any);

export default router;