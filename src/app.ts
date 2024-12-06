import express from 'express';
import bodyParser from 'body-parser';
import packageRoutes from './routes/packageRoutes'; // WAS ERROR HERE
import userRoutes from './routes/userRoutes'; // WAS ERROR HERE

const app = express();

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/packages', packageRoutes); // WAS ERROR HERE
app.use('/users', userRoutes); // WAS ERROR HERE

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;