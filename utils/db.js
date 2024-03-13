import { MongoClient } from 'mongodb';

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';
        const uri = `mongodb://${host}:${port}`;

        this.client = new MongoClient(uri, { useUnifiedTopology: true });
        this.db = null;
        this.connect();
    }

    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_DATABASE || 'files_manager');
            console.log('Connected to MongoDB');
        } catch (error) {
            console.error('Error connecting to MongoDB:', error.message);
        }
    }

    async isAlive() {
        return !!this.db;
    }

    async nbUsers() {
        try {
            const usersCollection = this.db.collection('users');
            const count = await usersCollection.countDocuments();
            return count;
        } catch (error) {
            console.error('Error counting documents in users collection:', error.message);
            return 0;
        }
    }

    async nbFiles() {
        try {
            const filesCollection = this.db.collection('files');
            const count = await filesCollection.countDocuments();
            return count;
        } catch (error) {
            console.error('Error counting documents in files collection:', error.message);
            return 0;
        }
    }
}

const dbClient = new DBClient();

export default dbClient;
