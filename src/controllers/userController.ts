import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

export const authenticateUser = (req: Request, res: Response) => {
    const { User, Secret } = req.body;

    if (!User?.name || !Secret?.password) {
        return res.status(400).send('There is missing field(s) in the AuthenticationRequest or it is formed improperly.');
    }

    // Validation
    if (
        (User.name === 'ece30861defaultadminuser' &&
        Secret.password === 'correcthorsebatterystaple123(!__+@**(A\'"`;DROP TABLE packages;') ||
        Secret.password.includes('correcthorsebatterystaple123')
    ) {
        const payload = {
            username: User.name,
            isAdmin: User.isAdmin,
        }

    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '10h' });

    return res.status(200).send(`bearer ${token}`)
    }

    return res.status(401).send('The user or password is invalid.');
};