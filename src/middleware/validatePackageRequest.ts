import { Request, Response } from 'express';

export const validatePackageRequest = (req: Request, res: Response, next: Function) => {
    const { metadata, data } = req.body;

    if (!metadata || !data) {
        return res.status(400).json({ error: 'Missing required fields: metadata and data are required.' });
    }

    const { Name, Version } = metadata;
    if (!Name || !Version) {
        return res.status(400).json({ error: 'Metadata must include Name, Version, and ID.' });
    }

    const { Content, URL } = data;
    if (!Content && !URL) {
        return res.status(400).json({ error: 'Data must include either Content or URL.' });
    }
    if (Content && URL) {
        return res.status(400).json({ error: 'Data cannot include both Content and URL.' });
    }

    next();
};
