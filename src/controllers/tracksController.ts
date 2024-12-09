import { Request, Response } from 'express';

export const getTracks = (req: Request, res: Response) => {
    const plannedTracks = [
        "Access control track"
    ];

    res.status(200).json({ plannedTracks });
};