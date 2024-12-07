import express from 'express';
import { uploadPackage, getPackageByID, getPackageByName, updatePackage } from '../controllers/packageController';
import { authenticateToken } from '../middleware/authMiddleware';
// import { validatePackageRequest } from '../middleware/validatePackageRequest';

const router = express.Router();

router.post('/', authenticateToken as any, uploadPackage as any);
router.get('/:id', authenticateToken as any, getPackageByID as any);
router.put('/:id', authenticateToken as any, updatePackage as any);
router.get('/byName/:Name', authenticateToken as any, getPackageByName as any);

export default router;