import express from 'express';
import { getTracks } from '../controllers/tracksController';

const router = express.Router();

router.get('/', getTracks);

export default router;