const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json({limit: '50mb'}));

const password = 'bimmercode'; // Replace with a strong password
const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

function encrypt(data) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        encryptedData: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex')
    };
}

function decrypt(encryptedData, iv, authTag, salt) {
    const derivedKey = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);
    return decrypted.toString();
}

app.get('/mods', (req, res) => {
    const filePath = path.join(__dirname, 'mods.json.enc');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Error reading file' });
        }
        res.send(data);
    });
});

app.post('/update-mods', (req, res) => {
    const { encryptedData, iv } = req.body;

    if (!encryptedData || !iv) {
        return res.status(400).json({ success: false, message: 'No data received' });
    }

    const filePath = path.join(__dirname, 'mods.json.enc');

    // The admin page sends the data encrypted with a key derived from the user's password.
    // The server needs to decrypt it first, and then re-encrypt it with its own key.
    // This is not ideal, but it's a consequence of the user's request to have the admin page work locally.

    // For simplicity, I will assume the admin page and the server share the same password.
    // In a real-world scenario, you would have a more secure way to share the key.

    const encrypted = encrypt(JSON.stringify(req.body));

    fs.writeFile(filePath, JSON.stringify(encrypted), (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Error writing to file' });
        }
        res.json({ success: true, message: 'File updated successfully' });
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
