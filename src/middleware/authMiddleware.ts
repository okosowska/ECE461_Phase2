import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-authorization'] as string;
    if (!token) return res.status(403).send('Token is missing.');

    try {
        const user = jwt.verify(token, SECRET_KEY);
        req.user = user; // WAS ERROR HERE
        next();
    } catch (err) {
        return res.status(403).send('Invalid or expired token.');
    }
};