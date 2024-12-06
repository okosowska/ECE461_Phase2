import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { fetchPackages } from '../controllers/packageController';

const router = express.Router();

router.get('/', authenticateToken as any, fetchPackages);

export default router;