import { Request, Response } from 'express';

export const getTracks = (req: Request, res: Response) => {
    res.status(200).json({
        plannedTracks: ["Access control track"],
    });
};