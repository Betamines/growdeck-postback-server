const express = require('express');
const crypto = require('crypto');
const axios = require('axios'); // Use axios for easier requests

const app = express();
const PORT = process.env.PORT || 3000;

const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com";
const POSTBACK_SECRET_KEY = "e4574240c62e6c2db436ca744c949e";

app.get('/postback', async (req, res) => {
    try {
        const { 
            user_id, 
            reward, 
            transaction_id, 
            signature,
            offer_name,
            task_name
        } = req.query;

        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("Missing required data");
        }

        // 1. Verify Signature
        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${POSTBACK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        const expectedSignature = crypto.createHmac('sha256', POSTBACK_SECRET_KEY).update(template).digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            return res.status(403).send("Invalid Signature");
        }

        // 2. Prevent Duplicate Credits
        const checkTx = await axios.get(`${FIREBASE_DB_URL}/processed_transactions/${transaction_id}.json`);
        if (checkTx.data) return res.status(200).send("Duplicate Transaction");

        // 3. Update User Balance (coins & balance)
        const userRes = await axios.get(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        if (!userRes.data) return res.status(404).send("User Not Found");

        const currentBalance = Number(userRes.data.balance || userRes.data.coins || 0);
        const newBalance = currentBalance + Number(reward);

        await axios.patch(`${FIREBASE_DB_URL}/users/${user_id}.json`, { 
            balance: newBalance,
            coins: newBalance
        });

        // 4. Save to History (This triggers the Android Notification I implemented)
        const historyData = {
            user_id,
            coins: Number(reward),
            offer_name: offer_name || "Game",
            task_name: task_name || "Offerwall",
            transaction_id,
            timestamp: Date.now()
        };

        await axios.post(`${FIREBASE_DB_URL}/history/${user_id}.json`, historyData);

        // 5. Mark Transaction as Processed
        await axios.put(`${FIREBASE_DB_URL}/processed_transactions/${transaction_id}.json`, { processed: true });

        return res.status(200).send("OK");
    } catch (error) {
        console.error("Postback Error:", error.message);
        return res.status(500).send("Server Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
