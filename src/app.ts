import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import packageRoutes from './routes/packageRoutes';
import packagesRoutes from './routes/packagesRoutes';
import resetRoutes from './routes/resetRoutes';
import userRoutes from './routes/userRoutes';
import tracksRoutes from './routes/tracksRoutes';
import { authenticateToken } from './middleware/authMiddleware';

dotenv.config()
const app = express();

// Middleware
app.use(bodyParser.json());

// Global Authentication
app.use((req, res, next) => {
    if (req.path === '/authenticate' || req.path === '/tracks') {
        return next();
    }
    authenticateToken(req, res, next);
});

// Routes
app.use('/packages', packagesRoutes);
app.use('/package', packageRoutes)
app.use('/reset', resetRoutes);
app.use('/', userRoutes);
app.use('/tracks', tracksRoutes);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;