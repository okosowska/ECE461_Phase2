import * as express from 'express';

declare global {
    namespace Express {
        interface Request {
            user?: any; // update this to specifics once figured out
        }
    }
}