import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import { dbClient } from './utils/db';

export const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.getFileByIdAndUserId(fileId, userId);

  if (!file) {
    throw new Error('File not found');
  }

  if (file.type === 'image') {
    const imageSizes = [500, 250, 100];
    const filePath = file.localPath;

    for (const size of imageSizes) {
      const thumbnailPath = `${filePath}_${size}`;

      await imageThumbnail(filePath, { width: size })
        .then((thumbnail) => fs.writeFileSync(thumbnailPath, thumbnail))
        .catch((error) => {
          console.error('Error generating thumbnail:', error);
          throw error;
        });
    }
  }
});
