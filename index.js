const express = require('express');
const crypto = require('crypto');

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
            offer_id,
            task_name,
            task_id
        } = req.query;

        // 🔹 1. Required check
        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("Missing data");
        }

        // 🔹 2. Signature verify
        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${POSTBACK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', POSTBACK_SECRET_KEY)
            .update(template)
            .digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            console.log("Invalid signature");
            return res.status(403).send("Invalid request");
        }

        // 🔥 3. Duplicate रोक (transaction_id)
        const checkTx = await fetch(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`);
        const txExists = await checkTx.json();

        if (txExists) {
            console.log("Duplicate transaction ignored");
            return res.status(200).send("Duplicate");
        }

        // 🔹 4. User data fetch
        const userRes = await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = await userRes.json();

        if (!userData) {
            return res.status(404).send("User not found");
        }

        const currentBalance = Number(userData.balance || userData.coins || 0);
        const newBalance = currentBalance + Number(reward);

        // 🔹 5. Update balance
        await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                balance: newBalance,
                coins: newBalance
            })
        });

        // 🔥 6. History save (MAIN FEATURE)
        const historyData = {
            user_id,
            coins: Number(reward),
            offer_name: offer_name || "Unknown Game",
            task_name: task_name || "Task",
            offer_id: offer_id || null,
            task_id: task_id || null,
            transaction_id,
            timestamp: Date.now()
        };

        await fetch(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(historyData)
        });

        // 🔹 7. Save transaction (duplicate रोक्न)
        await fetch(`${FIREBASE_DB_URL}/transactions/${transaction_id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ used: true })
        });

        console.log(`User ${user_id} earned ${reward} from ${offer_name}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).send("Server Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
