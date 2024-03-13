import redisClient from '../utils/redis';

class UsersController {
  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
	const user = await dbClient.getUser({ email });
  if (user) {
    res.status(400).send({ error: 'Already exist' });
    return;
  }

  const id = await dbClient.addUser({
    email,
    password: sha1(password),
  });

  if (!id) {
    res.status(500).send({ error: 'Error creating new user' });
  }

  res.status(201).send({
    id,
    email,
  })

    return res.status(200).json({ id: user._id.toString(), email: user.email });
  }
}

export default UsersController;
