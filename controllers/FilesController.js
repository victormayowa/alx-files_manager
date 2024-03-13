import { fileQueue } from './worker';
import fs from 'fs';
import path from 'path';
import { v4 as uuidV4 } from 'uuid';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const postUpload = async (req, res) => {
  const authToken = req.headers['x-token'];

  const userId = await redisClient.get(`auth_${authToken}`);
  if (!userId) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await dbClient.getUser({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const { name, type, data } = req.body;
  const parentId = req.body.parentId || 0;
  const isPublic = req.body.isPublic || false;

  if (!name) {
    res.status(400).send({ error: 'Missing name' });
    return;
  }
  if (!type || !['folder', 'file', 'image'].includes(type)) {
    res.status(400).send({ error: 'Missing type' });
    return;
  }
  if (!data && type !== 'folder') {
    res.status(400).send({ error: 'Missing data' });
    return;
  }

  if (parentId) {
    const parent = await dbClient.getFile({ _id: ObjectId(parentId) });
    if (!parent) {
      res.status(400).send({ error: 'Parent not found' });
      return;
    } if (parent.type !== 'folder') {
      res.status(400).send({ error: 'Parent is not a folder' });
      return;
    }
  }

  let file;
  if (type === 'folder') {
    file = await dbClient.addFile({
      userId: ObjectId(userId),
      name,
      type,
      parentId: parentId ? ObjectId(parentId) : 0,
      isPublic,
    });
  } else {
    const filesDir = path.join(process.env.FOLDER_PATH || '/tmp/files_manager');
    const filePath = `${filesDir}/${uuidV4()}`;
    await fs.mkdir(filesDir, { recursive: true }, (err) => console.log(err));
    await fs.writeFile(filePath, Buffer.from(data, 'base64').toString('utf-8'), (err) => {
      if (err) {
        console.log(err);
      }
    });

    file = await dbClient.addFile({
      userId: ObjectId(userId),
      name,
      type,
      parentId: parentId ? ObjectId(parentId) : 0,
      isPublic,
      localPath: `${filePath}`,
    });
  }

  res.status(201).send(file);
};

const getShow = async (req, res) => {
  const authToken = req.headers['x-token'];

  const userId = await redisClient.get(`auth_${authToken}`);
  if (!userId) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await dbClient.getUser({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  const file = await dbClient.getFile({ _id: ObjectId(id), userId: ObjectId(userId) });
  if (!file) {
    res.status(404).send({ error: 'Not found' });
    return;
  }

  file.id = file._id.toString();
  delete file._id;

  res.send(file);
};

const getIndex = async (req, res) => {
  const authToken = req.headers['x-token'];
  let { parentId, page } = req.query;

  const userId = await redisClient.get(`auth_${authToken}`);
  if (!userId) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await dbClient.getUser({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const parent = await dbClient.getFile({ _id: ObjectId(parentId) });
  if (parentId && !parent) {
    res.send([]);
    return;
  } if (!parentId) {
    parentId = 0;
  }

  if (!page) {
    page = 0;
  }

  const files = await dbClient.getUserFiles(userId, parentId, page);
  const userFiles = [];

  await files.forEach((file) => {
    userFiles.push(file);
  });

  res.send(userFiles);
};

const putPublish = async (req, res) => {
  const authToken = req.headers['x-token'];

  const userId = await redisClient.get(`auth_${authToken}`);
  if (!userId) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await dbClient.getUser({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  const file = await dbClient.getFile({ _id: ObjectId(id), userId: ObjectId(userId) });
  if (!file) {
    res.status(404).send({ error: 'Not found' });
    return;
  }

  await dbClient.updateFile(file._id, { isPublic: true });
  const updatedFile = await dbClient.getFile({ _id: file._id });
  updatedFile.id = updatedFile._id.toString();
  delete updatedFile._id;

  res.send(updatedFile);
};

const putUnpublish = async (req, res) => {
  const authToken = req.headers['x-token'];

  const userId = await redisClient.get(`auth_${authToken}`);
  if (!userId) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const user = await dbClient.getUser({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  const file = await dbClient.getFile({ _id: ObjectId(id), userId: ObjectId(userId) });
  if (!file) {
    res.status(404).send({ error: 'Not found' });
    return;
  }

  await dbClient.updateFile(file._id, { isPublic: false });
  const updatedFile = await dbClient.getFile({ _id: file._id });
  updatedFile.id = updatedFile._id.toString();
  delete updatedFile._id;

  res.send(updatedFile);
};

const getFile = async (req, res) => {
  const authToken = req.headers['x-token'];
  const { id } = req.params;
  const userId = await redisClient.get(`auth_${authToken}`);

  const user = await dbClient.getUser({ _id: ObjectId(userId) });
  const file = await dbClient.getFile({ _id: ObjectId(id) });
  if (!file || !file.isPublic || !user || file.userId.toString() !== userId) {
    res.status(404).send({ error: 'Not found' });
    return;
  }
  if (file.type === 'folder') {
    res.status(400).send({ error: "A folder doesn't have content" });
    return;
  }

  try {
    /* eslint-disable no-bitwise */
    fs.accessSync(file.localPath, (fs.constants.F_OK | fs.constants.R_OK));
    const mimeType = mime.lookup(file.name);
    const content = fs.readFileSync(file.localPath, { encoding: 'utf-8' });
    res.set('content-type', mimeType);
    res.send(content);
  } catch (err) {
    res.status(404).send({ error: 'Not found' });
  }
};

export {
  postUpload,
  getShow,
  getIndex,
  putPublish,
  putUnpublish,
  getFile,
};
