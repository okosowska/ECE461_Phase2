import express from 'express';
import { loginUser } from '../controllers/userController'; // WAS ERROR HERE

const router = express.Router();
router.post('/login', loginUser as any); // look into "as any"

export default router;