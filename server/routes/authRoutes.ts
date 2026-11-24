import { Router } from 'express';
import { login, getMe, getUsers, updateUserCredentials } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.get('/me', getMe);
router.get('/users', getUsers);
router.put('/users/:role', updateUserCredentials);

export default router;
