const aws = require('aws-sdk');
const KEY_SPEC = 'AES_256';
const {decrypt, encrypt} = require('./../utils/aes256gcm')

class DataEncryptionService {
    constructor(keyStorageModel) {
        this.keyStorageModel = keyStorageModel;
        this.kmsClient = new aws.KMS({ region: 'us-east-1'});
        this.encrypt = this.encrypt.bind(this)
        this.decrypt = this.decrypt.bind(this)
    }

    async encrypt(userId, data) {
        const [encryptedKey, key] = await this.createDEK();
        const encryptedData = encrypt(data, key);
        const existingKey = await this.keyStorageModel.findOne({where: {userId}});
        if (existingKey) {
            await this.keyStorageModel.update({DEK: encryptedKey.toString('hex')}, {where: {userId}});
        } else {
            await this.keyStorageModel.create({DEK: encryptedKey.toString('hex'), userId});
        }

        return encryptedData;
    }

    async decrypt(userId, encryptedData) {
        const { DEK } = await this.keyStorageModel.findOne({where: {userId}});
        const decryptedKey = await this.decryptDEK(DEK);
        return decrypt(encryptedData, decryptedKey);
    }

    createDEK() {
        return new Promise((resolve, reject) => {
            this.kmsClient.generateDataKey({KeyId: process.env.KEY_ID, KeySpec: KEY_SPEC}, (err, data) => {
                if(err) {
                    return reject(err);
                }
                const { CiphertextBlob, Plaintext } = data;
                resolve([CiphertextBlob, Plaintext]);
            })
        })
    }

    decryptDEK(key) {
        return new Promise((resolve, reject) => {
            this.kmsClient.decrypt({CiphertextBlob: new Buffer(key, 'hex'), KeyId: process.env.KEY_ID}, (err, data) => {
                if (err) {
                    return reject(err);
                }

                const {Plaintext} = data;
                resolve(Plaintext);
            })
        })
    }
}

module.exports = DataEncryptionService;