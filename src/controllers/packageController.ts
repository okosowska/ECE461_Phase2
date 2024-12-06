import { Request, Response } from 'express';

export const uploadPackage = (req: Request, res: Response) => {
    // IMPLEMENT UPLOAD PACKAGE HERE
    res.send('Package uploaded.');
};

export const fetchPackages = (req: Request, res: Response) => {
    // IMPLEMENT FETCH PACKAGES HERE
    res.send('List of packages.');
}