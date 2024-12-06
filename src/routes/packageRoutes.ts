import express from 'express';
import { uploadPackage, fetchPackages } from '../controllers/packageController'; // WAS ERROR HERE
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', authenticateToken as any, uploadPackage);
router.get('/', authenticateToken as any, fetchPackages);

export default router;