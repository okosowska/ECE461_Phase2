import express from 'express';
import { uploadPackage, getPackageByID, getPackageByName } from '../controllers/packageController';
import { authenticateToken } from '../middleware/authMiddleware';
import { validatePackageRequest } from '../middleware/validatePackageRequest';

const router = express.Router();

router.post('/', authenticateToken as any, validatePackageRequest as any, uploadPackage as any);
router.get('/:ID', authenticateToken as any, getPackageByID as any);
router.get('/byName/:Name', authenticateToken as any, getPackageByName as any);

export default router;