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
        User.name === 'ece30861defaultadminuser' &&
        Secret.password === 'correcthorsebatterystaple123(!__+@**(A\'"`;DROP TABLE packages;' // CHECK WHY NEED \'" added in password
    ) {
        const payload = {
            username: User.name,
            isAdmin: User.isAdmin,
        }

    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

    return res.status(200).json({ token: `bearer ${token}` })
    }

    return res.status(401).send('The user or password is invalid.');
};