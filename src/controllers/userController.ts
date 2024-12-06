import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

export const loginUser = (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (
        username === 'ece30861defaultadminuser' &&
        password === 'correcthorsebatterystaple123(!__+@**(A;DROP TABLE packages'
    ) {
        const token = jwt.sign({ username, role: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
        return res.status(200).json({ token });
    }

    return res.status(401).send('Invalid credentials.');
};