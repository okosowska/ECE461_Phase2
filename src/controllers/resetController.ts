import { Request, Response } from "express";

let registry = {
    packages: [],
    users: [{ username: 'ece30861defaultadminuser', isAdmin: true }],
}

export const resetRegistry = (req: Request, res: Response) => {
    try {
        registry = {
            packages: [],
            users: [{ username: 'ece30861defaultadminuser', isAdmin: true }],
        };

        res.status(200).send('Registry has been reset.');
    } catch (error) {
        console.error('Error resetting registry:', error);
        res.status(500).send('Failed to reset registry.');
    }
};