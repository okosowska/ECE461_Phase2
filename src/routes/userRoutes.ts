import express from 'express';
import { authenticateUser } from '../controllers/userController'; // WAS ERROR HERE

const router = express.Router();
router.put('/authenticate', authenticateUser as any); // look into "as any"

export default router;